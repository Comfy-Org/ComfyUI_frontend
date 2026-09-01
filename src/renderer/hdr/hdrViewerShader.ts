export const HDR_VIEWER_VERTEX_SHADER = `
out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const HDR_VIEWER_FRAGMENT_SHADER = `
in vec2 vUv;
out vec4 frag_color;

uniform sampler2D uImage;
uniform mat3 uGamutToSRGB;
uniform float uGain;
uniform int uChannel;
uniform bool uDither;
uniform bool uClipWarnings;
uniform vec2 uClipRange;

float linearToS(float a) {
  float s = sign(a);
  a = abs(a);
  return s * (a < 0.0031308 ? 12.92 * a : 1.055 * pow(a, 1.0 / 2.4) - 0.055);
}

vec3 linearToSRGB(vec3 c) {
  return vec3(linearToS(c.r), linearToS(c.g), linearToS(c.b));
}

float ign(vec2 p) {
  return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y));
}

float tent(float r) {
  float rp = sqrt(2.0 * r);
  float rn = sqrt(2.0 * r + 1.0) - 1.0;
  return (r < 0.0) ? 0.5 * rn : 0.5 * rp;
}

void main() {
  vec4 texel = texture(uImage, vUv);
  vec3 mapped = uGamutToSRGB * texel.rgb;

  vec3 selected;
  if (uChannel == 1) selected = vec3(mapped.r);
  else if (uChannel == 2) selected = vec3(mapped.g);
  else if (uChannel == 3) selected = vec3(mapped.b);
  else if (uChannel == 4) selected = vec3(texel.a);
  else if (uChannel == 5)
    selected = vec3(dot(mapped, vec3(0.2126, 0.7152, 0.0722)));
  else selected = mapped;

  vec3 exposed = selected * uGain;

  vec3 display = linearToSRGB(exposed);

  if (uDither) {
    float r = ign(gl_FragCoord.xy) - 0.5;
    display += vec3(tent(r) / 255.0);
  }

  display = clamp(display, 0.0, 1.0);

  if (uClipWarnings) {
    float zebra1 =
      mod(floor((gl_FragCoord.x + gl_FragCoord.y) / 8.0), 2.0) == 0.0 ? 0.0 : 1.0;
    float zebra2 =
      mod(floor((gl_FragCoord.x - gl_FragCoord.y) / 8.0), 2.0) == 0.0 ? 0.0 : 1.0;
    bvec3 over = greaterThan(exposed, vec3(uClipRange.y));
    bvec3 under = lessThan(exposed, vec3(uClipRange.x));
    display = mix(display, vec3(zebra1), vec3(over));
    display = mix(display, vec3(zebra2), vec3(under));
  }

  frag_color = vec4(display, 1.0);
}
`
