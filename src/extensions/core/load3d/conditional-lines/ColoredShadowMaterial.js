/*
Taken from: https://github.com/gkjohnson/threejs-sandbox/tree/master/conditional-lines
under MIT license
 */
import { Color, ShaderLib, ShaderMaterial, UniformsUtils } from 'three'

export class ColoredShadowMaterial extends ShaderMaterial {
  get color() {
    return this.uniforms.diffuse.value
  }

  get shadowColor() {
    return this.uniforms.shadowColor.value
  }

  set shininess(v) {
    this.uniforms.shininess.value = v
  }
  get shininess() {
    return this.uniforms.shininess.value
  }

  constructor(options) {
    super({
      uniforms: UniformsUtils.merge([
        ShaderLib.phong.uniforms,
        {
          shadowColor: {
            value: new Color(0xff0000)
          }
        }
      ]),
      vertexShader: `
				#define PHONG
				varying vec3 vViewPosition;
				#ifndef FLAT_SHADED
					varying vec3 vNormal;
				#endif
				#include <common>
				#include <uv_pars_vertex>
				#include <uv2_pars_vertex>
				#include <displacementmap_pars_vertex>
				#include <envmap_pars_vertex>
				#include <color_pars_vertex>
				#include <fog_pars_vertex>
				#include <morphtarget_pars_vertex>
				#include <skinning_pars_vertex>
				#include <shadowmap_pars_vertex>
				#include <logdepthbuf_pars_vertex>
				#include <clipping_planes_pars_vertex>
				void main() {
					#include <uv_vertex>
					#include <uv2_vertex>
					#include <color_vertex>
					#include <beginnormal_vertex>
					#include <morphnormal_vertex>
					#include <skinbase_vertex>
					#include <skinnormal_vertex>
					#include <defaultnormal_vertex>
				#ifndef FLAT_SHADED
					vNormal = normalize( transformedNormal );
				#endif
					#include <begin_vertex>
					#include <morphtarget_vertex>
					#include <skinning_vertex>
					#include <displacementmap_vertex>
					#include <project_vertex>
					#include <logdepthbuf_vertex>
					#include <clipping_planes_vertex>
					vViewPosition = - mvPosition.xyz;
					#include <worldpos_vertex>
					#include <envmap_vertex>
					#include <shadowmap_vertex>
					#include <fog_vertex>
				}
			`,
      fragmentShader: `
				#define PHONG
				uniform vec3 diffuse;
				uniform vec3 emissive;
				uniform vec3 specular;
				uniform float shininess;
				uniform float opacity;
				uniform vec3 shadowColor;
				#include <common>
				#include <packing>
				#include <dithering_pars_fragment>
				#include <color_pars_fragment>
				#include <uv_pars_fragment>
				#include <uv2_pars_fragment>
				#include <map_pars_fragment>
				#include <alphamap_pars_fragment>
				#include <aomap_pars_fragment>
				#include <lightmap_pars_fragment>
				#include <emissivemap_pars_fragment>
				#include <envmap_common_pars_fragment>
				#include <envmap_pars_fragment>
				#include <cube_uv_reflection_fragment>
				#include <fog_pars_fragment>
				#include <bsdfs>
				#include <lights_pars_begin>
				#include <lights_phong_pars_fragment>
				#include <shadowmap_pars_fragment>
				#include <bumpmap_pars_fragment>
				#include <normalmap_pars_fragment>
				#include <specularmap_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <clipping_planes_pars_fragment>
				void main() {
					#include <clipping_planes_fragment>
					vec4 diffuseColor = vec4( 1.0, 1.0, 1.0, opacity );
					ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
					vec3 totalEmissiveRadiance = emissive;
					#include <logdepthbuf_fragment>
					#include <map_fragment>
					#include <color_fragment>
					#include <alphamap_fragment>
					#include <alphatest_fragment>
					#include <specularmap_fragment>
					#include <normal_fragment_begin>
					#include <normal_fragment_maps>
					#include <emissivemap_fragment>
					#include <lights_phong_fragment>
					#include <lights_fragment_begin>
					#include <lights_fragment_maps>
					#include <lights_fragment_end>
					#include <aomap_fragment>
					vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
					#include <envmap_fragment>

					gl_FragColor = vec4( outgoingLight, diffuseColor.a );
					#include <tonemapping_fragment>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>
					#include <dithering_fragment>

					gl_FragColor.rgb = mix(
						shadowColor.rgb,
						diffuse.rgb,
						min( gl_FragColor.r, 1.0 )
					);

				}

			`
    })

    Object.defineProperties(this, {
      opacity: {
        set(v) {
          this.uniforms.opacity.value = v
        },

        get() {
          return this.uniforms.opacity.value
        }
      }
    })

    this.setValues(options)
    this.lights = true
  }
}
