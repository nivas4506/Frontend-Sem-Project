// The fiber effect uses the browser's WebGL API directly, without a rendering library.
const vertexSource = `
  attribute vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragmentSource = `
  precision highp float;
  uniform vec2 resolution;
  uniform float elapsed;
  mat2 rotate(float angle) {
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }
  float grainHash(vec2 point) {
    return fract(52.9829189 * fract(dot(floor(point), vec2(0.065, 0.005))));
  }
  void main() {
    vec2 uv = (2.0 * gl_FragCoord.xy - resolution) / max(resolution.y, 1.0);
    float time = elapsed * 0.2;
    vec3 lineColor = vec3(0.078431, 0.054902, 0.207843);
    vec3 glowColor = vec3(0.203922, 0.215686, 0.627451);
    vec2 p = rotate(time * 0.25) * (uv / 2.0);
    vec3 color = vec3(0.0);
    for (int index = 0; index < 4; index++) {
      float layer = float(index) + 1.0;
      p += 0.015 * sin(p.yx * layer * 3.0 + time * (0.15 + layer * 0.08));
      float radius = length(p);
      float angle = atan(p.y, p.x) + sin(radius * 5.0 - time * 1.2 + layer) * 0.1;
      p = vec2(cos(angle), sin(angle)) * radius;
      float lines = abs(sin(p.x * (5.0 + layer * 2.0) + sin(p.y * 3.0 + time)));
      lines = pow(max(0.0, 1.0 - lines), 16.0);
      color += lineColor * lines / layer;
      float glow = exp(-10.0 * abs(sin(p.x * 3.0 + time + layer)));
      color += glowColor * glow * 1.6 / (layer * 2.0);
    }
    float center = exp(-2.2 * dot(uv, uv));
    color += max(lineColor * 0.85567 - glowColor * 0.06186, vec3(0.0)) * center;
    float cloud = exp(-1.5 * length(uv + vec2(sin(time * 0.3) * 0.25, cos(time * 0.25) * 0.18)));
    color += (lineColor * 0.19588 + glowColor * 0.2268) * cloud;
    float vignette = 1.0 - smoothstep(0.35, 1.45, length(uv));
    color *= mix(0.2, 1.0, vignette);
    color = 1.0 - exp(-color * 2.0);
    color.b *= 1.25;
    vec2 point = mod(gl_FragCoord.xy + vec2(elapsed * 30.0, -elapsed * 21.0), 1024.0);
    point = mat2(0.8, -0.5, 0.5, 0.8) * point;
    float noise = 0.4 * grainHash(point) + 0.25 * grainHash(point * 2.0 + 17.0)
      + 0.2 * grainHash(point * 4.0 + 47.0) + 0.1 * grainHash(point * 8.0 + 113.0)
      + 0.05 * grainHash(point * 16.0 + 191.0);
    gl_FragColor = vec4(clamp(vec3(0.070588, 0.058824, 0.090196) + color + (noise - 0.5) * 0.05, 0.0, 1.0), 1.0);
  }
`;

export function startBackground(canvas) {
  const background = canvas.parentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let mode = 'fibers';
  let frame = 0;
  let elapsed = 0;
  let previous = 0;
  let gl;
  let program;
  let buffer;
  let resolution;
  let time;
  let stopped = false;

  function initialize() {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) return;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return;
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); program = null; return; }
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    resolution = gl.getUniformLocation(program, 'resolution');
    time = gl.getUniformLocation(program, 'elapsed');
    canvas.classList.add('ready');
  }

  function draw() {
    if (stopped || !program || gl.isContextLost()) return;
    gl.useProgram(program);
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform1f(time, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function resize() {
    if (!program) return;
    canvas.width = Math.max(1, Math.round(innerWidth));
    canvas.height = Math.max(1, Math.round(innerHeight));
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw();
  }

  function tick(now) {
    frame = 0;
    elapsed += Math.min((now - previous) / 1000, 0.1);
    previous = now;
    draw();
    frame = requestAnimationFrame(tick);
  }

  function updateAnimation() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (stopped || !program || gl.isContextLost() || mode !== 'fibers' || document.hidden) return;
    draw();
    if (!reducedMotion.matches) { previous = performance.now(); frame = requestAnimationFrame(tick); }
  }

  const handleResize = () => resize();
  const handleVisibilityChange = () => updateAnimation();
  const handleReducedMotionChange = () => updateAnimation();
  const handleContextLost = event => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    frame = 0;
    canvas.classList.remove('ready');
  };
  const handleContextRestored = () => {
    if (stopped) return;
    initialize();
    resize();
    updateAnimation();
  };
  const handlePointerMove = event => {
    if (mode !== 'silk' || reducedMotion.matches) return;
    background.style.setProperty('--light-x', `${event.clientX / innerWidth * 100}%`);
    background.style.setProperty('--light-y', `${event.clientY / innerHeight * 100}%`);
  };

  initialize();
  resize();
  window.addEventListener('resize', handleResize);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  reducedMotion.addEventListener('change', handleReducedMotionChange);
  canvas.addEventListener('webglcontextlost', handleContextLost);
  canvas.addEventListener('webglcontextrestored', handleContextRestored);
  document.addEventListener('pointermove', handlePointerMove, { passive: true });

  const setMode = nextMode => {
    if (stopped) return;
    mode = nextMode === 'silk' ? 'silk' : 'fibers';
    background.dataset.mode = mode;
    updateAnimation();
  };
  setMode.destroy = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    reducedMotion.removeEventListener('change', handleReducedMotionChange);
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    document.removeEventListener('pointermove', handlePointerMove);
  };

  return setMode;
}
