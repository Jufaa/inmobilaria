 'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Building2, ArrowUpRight, Plus, Pause, Play } from 'lucide-react';
import { AGENCY_REGISTRY_KEY, defaultAgencies, parseAgencies, agencyStorageKey, agencyPublicPath, agencySeeds, createAgencyRepository, type Agency } from '@/lib/agencies';
import { parseRepository, mergeDemoSeeds, selectPublicProperties, validateBrand } from '@/lib/demo-repository';
export default function SellerDashboard() {
 const [agencies,setAgencies] = useState(defaultAgencies);
 const [ready,setReady] = useState(false);
 const [counts,setCounts] = useState<Record<string,{total:number;published:number;name:string;color:string;logo:string}>>({});
 const [creating,setCreating] = useState(false);
 const [name,setName] = useState('');
 const [color,setColor] = useState('#0f766e');
 const [notice,setNotice] = useState('');
 useEffect(() => { try { const saved=parseAgencies(JSON.parse(localStorage.getItem(AGENCY_REGISTRY_KEY)||'null')); if(saved)setAgencies(saved); } catch {} setReady(true); },[]);
 useEffect(() => { if(!ready)return; const refresh=()=>{const next:typeof counts={}; for(const agency of agencies){let repo=createAgencyRepository(agency);try{const saved=parseRepository(JSON.parse(localStorage.getItem(agencyStorageKey(agency.id))||'null'));if(saved)repo=mergeDemoSeeds(saved,agencySeeds(agency));}catch{} next[agency.id]={total:repo.catalog.length,published:selectPublicProperties(repo.catalog).length,...repo.brand};}setCounts(next);};refresh();window.addEventListener('focus',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh);}; },[agencies,ready]);
 const persist=(next:Agency[])=>{try{localStorage.setItem(AGENCY_REGISTRY_KEY,JSON.stringify(next));setAgencies(next);return true;}catch{setNotice('No se pudo guardar la inmobiliaria. Revisá el almacenamiento del navegador.');return false;}};
 const create=(event:React.FormEvent)=>{event.preventDefault();const errors=validateBrand({name:name.trim(),color,logo:''});if(errors.length){setNotice(errors.join(' '));return;}const agency:Agency={id:`empresa-${Date.now().toString(36)}`,name:name.trim(),color,logo:'',status:'active',sample:3};if(persist([...agencies,agency])){setCreating(false);setName('');setNotice('Inmobiliaria creada con catálogo vacío. Entrá en Administrar para publicar tu primera propiedad de prueba.');}};
 return <main className="seller-app">
 <header className="seller-header"><Link href="/vendedor" className="seller-wordmark"><Building2 size={25}/>Panel del vendedor</Link><span className="seller-badge">Vista del vendedor · Demo</span></header>
 <section className="seller-intro"><div><p className="seller-eyebrow">TU CARTERA DE INMOBILIARIAS</p><h1>Un lugar para gestionar cada empresa.</h1><p>Entrá al panel de cada inmobiliaria o recorré su sitio como lo vería un cliente.</p></div><button className="seller-primary" disabled={!ready} onClick={()=>{setCreating(!creating);setNotice('');}}><Plus size={19}/>Nueva inmobiliaria</button></section>
 <div className="seller-summary"><strong>{agencies.length} inmobiliarias</strong><span>{agencies.filter(a=>a.status==='active').length} activas</span><span>{agencies.filter(a=>a.status==='paused').length} pausadas</span></div>
 <p className="seller-local-note">Datos de demostración guardados en este navegador. Esta vista no tiene autenticación ni control de acceso; la pausa permite seguir abriendo vistas previas.</p>
 {notice&&<p className="seller-notice" role="status">{notice}</p>}
 {creating&&<form className="seller-create" onSubmit={create}><h2>Nueva inmobiliaria</h2><label>Nombre de la empresa<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Ej.: Mi Inmobiliaria"/></label><label>Color de la marca<input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><p>Comienza con un catálogo vacío en Río Cuarto. Podés cargar propiedades y completar la identidad desde su panel.</p><div><button className="seller-primary" type="submit">Crear inmobiliaria</button><button type="button" onClick={()=>setCreating(false)}>Cancelar</button></div></form>}
 {!ready&&<p role="status">Cargando empresas guardadas…</p>}
 <section className="seller-grid" aria-label="Inmobiliarias">{agencies.map((agency,index)=>{const info=counts[agency.id];const brand=info??agency;return <article className="seller-card" key={agency.id} style={{'--company-color':brand.color} as React.CSSProperties}><div className="seller-card-top"><div className="seller-logo">{brand.logo?<img src={brand.logo} alt=""/>:<Building2 size={27}/>}</div><span className={`seller-status ${agency.status}`}>{agency.status==='active'?'Activa':'Pausada'}</span></div><p className="seller-company-number">INMOBILIARIA {String(index+1).padStart(2,'0')}</p><h2>{brand.name}</h2><p>Río Cuarto, Córdoba</p><div className="seller-card-counts"><div><strong>{info?.total??'—'}</strong><span>propiedades</span></div><div><strong>{info?.published??'—'}</strong><span>visibles en el sitio</span></div></div><div className="seller-card-actions"><Link className="seller-primary" href={`${agencyPublicPath(agency.id)}/panel`}>Administrar <ArrowUpRight size={18}/></Link><Link href={agencyPublicPath(agency.id)}>Ver mapa <ArrowUpRight size={18}/></Link></div><button className="seller-pause" disabled={!ready} onClick={()=>persist(agencies.map(a=>a.id===agency.id?{...a,status:a.status==='active'?'paused':'active'}:a))}>{agency.status==='active'?<Pause size={15}/>:<Play size={15}/>} {agency.status==='active'?'Pausar en la demo':'Activar en la demo'}</button></article>;})}</section>
 <footer className="seller-footer">Cada empresa tiene su catálogo, consultas, visitas, favoritos e identidad independientes dentro de esta demo local.</footer>
 </main>;
}
