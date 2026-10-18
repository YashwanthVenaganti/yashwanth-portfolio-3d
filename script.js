const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const scene=document.querySelector('.scene');
const core=scene?.querySelector('.core');
const canvas=document.querySelector('.orb-canvas');

// Build a small, dependency-free WebGL sphere with animated light, surface bands and a moving rim.
if(canvas&&scene&&!reduce){
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:true});
  if(gl){
    const vertex=`#version 300 es
      in vec3 aPosition; in vec3 aNormal; uniform mat4 uMVP; uniform mat4 uModel;
      out vec3 vNormal; out vec3 vPosition;
      void main(){ vec4 p=uModel*vec4(aPosition,1.0); vPosition=p.xyz; vNormal=mat3(uModel)*aNormal; gl_Position=uMVP*vec4(aPosition,1.0); }`;
    const fragment=`#version 300 es
      precision highp float; in vec3 vNormal; in vec3 vPosition; uniform float uTime; uniform vec2 uPointer; out vec4 color;
      void main(){
        vec3 n=normalize(vNormal); vec3 view=normalize(vec3(0.0,0.0,3.2)-vPosition);
        vec3 key=normalize(vec3(-0.65+uPointer.x*0.45,0.8-uPointer.y*0.35,1.35));
        float diff=max(dot(n,key),0.0); float fres=pow(1.0-max(dot(n,view),0.0),2.4);
        float bands=0.5+0.5*sin(vPosition.y*34.0+sin(vPosition.x*12.0+uTime*0.7)*1.6+uTime*1.2);
        float sweep=pow(max(0.0,sin(atan(n.z,n.x)*3.0+uTime*0.9)),10.0);
        vec3 deep=vec3(0.035,0.055,0.034); vec3 green=vec3(0.49,0.70,0.22); vec3 lime=vec3(0.80,0.98,0.42);
        vec3 base=mix(deep,green,0.18+0.34*bands); base+=lime*(0.42*diff+0.27*sweep); base+=vec3(0.55,0.65,0.40)*fres*0.7;
        float spec=pow(max(dot(reflect(-key,n),view),0.0),42.0); base+=vec3(0.88,1.0,0.70)*spec*0.85;
        color=vec4(base,0.96);
      }`;
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
    try{
      const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
      const positions=[],normals=[],indices=[],lat=48,lon=64;
      for(let y=0;y<=lat;y++){const a=y*Math.PI/lat;for(let x=0;x<=lon;x++){const b=x*2*Math.PI/lon,nx=-Math.cos(b)*Math.sin(a),ny=Math.cos(a),nz=Math.sin(b)*Math.sin(a);positions.push(nx,ny,nz);normals.push(nx,ny,nz)}}
      for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const i=y*(lon+1)+x;indices.push(i,i+lon+1,i+1,i+1,i+lon+1,i+lon+2)}
      const buffer=(name,data,size)=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0)};
      buffer('aPosition',positions,3);buffer('aNormal',normals,3);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
      const loc={mvp:gl.getUniformLocation(program,'uMVP'),model:gl.getUniformLocation(program,'uModel'),time:gl.getUniformLocation(program,'uTime'),pointer:gl.getUniformLocation(program,'uPointer')};
      const mul=(a,b)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o};
      const rotX=a=>new Float32Array([1,0,0,0,0,Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1]);
      const rotY=a=>new Float32Array([Math.cos(a),0,-Math.sin(a),0,0,1,0,0,Math.sin(a),0,Math.cos(a),0,0,0,0,1]);
      const perspective=(f,aspect,n,far)=>{const fct=1/Math.tan(f/2),nf=1/(n-far);return new Float32Array([fct/aspect,0,0,0,0,fct,0,0,0,0,(far+n)*nf,-1,0,0,2*far*n*nf,0])};
      const translate=(z)=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,z,1]);
      const pointer={x:0,y:0},target={x:0,y:0};
      scene.addEventListener('pointermove',e=>{const r=scene.getBoundingClientRect();target.x=(e.clientX-r.left)/r.width-.5;target.y=(e.clientY-r.top)/r.height-.5});
      scene.addEventListener('pointerleave',()=>{target.x=0;target.y=0});
      const resize=()=>{const d=Math.min(devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*d),h=Math.round(canvas.clientHeight*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}};
      core&&(core.style.opacity='0');canvas.style.display='block';
      const draw=now=>{resize();const t=now*.001;pointer.x+=(target.x-pointer.x)*.055;pointer.y+=(target.y-pointer.y)*.055;
        const model=mul(rotY(t*.32+pointer.x*.48),rotX(.18+pointer.y*.45));const mvp=mul(mul(perspective(Math.PI/4,canvas.width/canvas.height,.1,100),translate(-3.15)),model);
        gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        gl.uniformMatrix4fv(loc.mvp,false,mvp);gl.uniformMatrix4fv(loc.model,false,model);gl.uniform1f(loc.time,t);gl.uniform2f(loc.pointer,pointer.x,pointer.y);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);requestAnimationFrame(draw)};
      requestAnimationFrame(draw);
    }catch(err){canvas.style.display='none';core&&(core.style.opacity='1');console.warn('3D sphere fallback active',err)}
  }else canvas.style.display='none';
}

// Give the hero's orbital rings a little more depth as the pointer moves.
if(scene){scene.addEventListener('pointermove',e=>{const r=scene.getBoundingClientRect();scene.style.setProperty('--tilt-x',`${((e.clientY-r.top)/r.height-.5)*-8}deg`);scene.style.setProperty('--tilt-y',`${((e.clientX-r.left)/r.width-.5)*10}deg`)});scene.addEventListener('pointerleave',()=>{scene.style.setProperty('--scene-tilt-x','0deg');scene.style.setProperty('--scene-tilt-y','0deg')})}

// Pointer-driven project cards move in perspective and ease back when the pointer leaves.
document.querySelectorAll('.project-visual').forEach(card=>{
  card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.setProperty('--tilt-x',`${-y*8}deg`);card.style.setProperty('--tilt-y',`${x*10}deg`);card.style.setProperty('--lift','12px')});
  card.addEventListener('pointerleave',()=>{card.style.setProperty('--tilt-x','0deg');card.style.setProperty('--tilt-y','0deg');card.style.setProperty('--lift','0px')});
});

const toggle=document.querySelector('.menu'),nav=document.querySelector('.nav nav');toggle?.addEventListener('click',()=>nav.classList.toggle('open'));nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
if(!reduce&&'IntersectionObserver'in window){const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealed');io.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -35px 0px'});document.querySelectorAll('.project,.timeline article,.skill-group,.section-head,.education,.statement>p,.contact-side').forEach((el,i)=>{el.classList.add('reveal');el.style.setProperty('--reveal-delay',`${(i%4)*90}ms`);io.observe(el)})}

