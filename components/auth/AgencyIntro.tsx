'use client';
import {useEffect,useState} from 'react';
import {hasSeenAgencyIntro,rememberAgencyIntro} from '@/lib/agency-intro';
import {PresentationVideo} from './PresentationVideo';
export function AgencyIntro({agencyId,src,title,enabled}:{agencyId:string;src:string;title:string;enabled:boolean}) {
  const [show,setShow]=useState(false);
  function storage(){try{return window.localStorage;}catch{return undefined;}}
  useEffect(()=>{setShow(enabled&&!!src&&!hasSeenAgencyIntro(storage(),agencyId,src));},[agencyId,src,enabled]);
  const remember=()=>rememberAgencyIntro(storage(),agencyId,src);
  if(!show)return null;
  return <PresentationVideo autoStart src={src} title={title} continueLabel="Ver mapa" onStarted={remember} onContinue={()=>{remember();setShow(false);}}/>;
}
