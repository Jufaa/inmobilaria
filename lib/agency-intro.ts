type IntroStorage = Pick<Storage, 'getItem' | 'setItem'>;
const shownInThisApp = new Set<string>();
const introKey = (agencyId:string,src:string) => `territorio:agency-intro:v1:${encodeURIComponent(agencyId)}:${encodeURIComponent(src)}`;
export function hasSeenAgencyIntro(storage:IntroStorage|undefined,agencyId:string,src:string) {
  const key=introKey(agencyId,src);
  if(shownInThisApp.has(key))return true;
  try{return storage?.getItem(key)==='1';}catch{return false;}
}
export function rememberAgencyIntro(storage:IntroStorage|undefined,agencyId:string,src:string) {
  const key=introKey(agencyId,src);
  shownInThisApp.add(key);
  try{storage?.setItem(key,'1');}catch{/* Browser storage may be disabled; the current app still remembers. */}
}
