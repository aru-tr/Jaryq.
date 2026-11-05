/* SI units internally; public inputs: nm, µm, mm and degrees. */
(function(root) {
  'use strict';
  const radians = degrees => degrees * Math.PI / 180;
  const sinc = x => Math.abs(x) < 1e-8 ? 1 : Math.sin(x) / x;
  function monochromatic(kind, p, wavelength) {
    const lambda = wavelength * 1e-9;
    if (kind === 'interference') {
      return Math.sin(2 * Math.PI * p.gap * 1e-6 * Math.cos(radians(p.angle)) / lambda) ** 2;
    }
    if (kind === 'diffraction') {
      const x = p.position * 1e-3, L = p.distance;
      const sinTheta = x / Math.hypot(L, x);
      const width = p.grating ? 2e-6 : p.slit * 1e-3;
      let value = sinc(Math.PI * width * sinTheta / lambda) ** 2;
      if (p.grating) {
        const q = Math.PI * 1e-5 * sinTheta / lambda;
        const denominator = Math.sin(q);
        value *= Math.abs(denominator) < 1e-8 ? 1 : (Math.sin(8*q) / (8*denominator)) ** 2;
      }
      return Math.min(1, Math.max(0, value));
    }
    return Math.cos(radians(p.alpha)) ** 2;
  }
  function intensity(kind, p) {
    if (kind === 'polarization' || p.light === 'mono') return monochromatic(kind, p, p.wavelength);
    // Equal spectral weights, 400–700 nm; intensity is normalized by incident intensity.
    return Array.from({length:31}, (_,i) => monochromatic(kind,p,400+i*10)).reduce((a,b)=>a+b,0)/31;
  }
  function bounds(kind,p) { return kind === 'interference' ? [0,2] : kind === 'diffraction' ? (p.grating ? [-75,75] : [-4,4]) : [0,360]; }
  const parameter = kind => ({interference:'gap',diffraction:'position',polarization:'alpha'})[kind];
  function sample(kind,p) {
    const [lo,hi] = bounds(kind,p), value=p[parameter(kind)], ratio=intensity(kind,p);
    const settings=Object.fromEntries(['gap','angle','light','wavelength','slit','grating','position','distance','alpha','imax'].map(key=>[key,p[key]]));
    return {...settings, value, u:(value-lo)/(hi-lo), ratio, i:ratio*p.imax,
      ...(kind==='polarization'?{cos:Math.cos(radians(p.alpha)),sq:ratio,i0:p.imax}:{})};
  }
  function sweep(kind,p) { const [lo,hi]=bounds(kind,p); return Array.from({length:25},(_,i)=>sample(kind,{...p,[parameter(kind)]:lo+(hi-lo)*i/24})); }
  const api={intensity,monochromatic,bounds,parameter,sample,sweep};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.LabPhysics=api;
})(typeof window === 'undefined' ? globalThis : window);
