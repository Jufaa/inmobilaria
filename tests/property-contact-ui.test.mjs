import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as contactsApi from '../lib/properties/property-whatsapp.ts';
const require=createRequire(import.meta.url);
function compile(path,mocks){const output={};const code=ts.transpileModule(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;new Function('require','exports',code)(id=>mocks[id]??(id.endsWith('.module.css')?{__esModule:true,default:{}}:require(id)),output);return output;}
test('WhatsApp button is absent when unconfigured and uses the current browser origin without sending anything',()=>{
 const slots=[],effects=[];let cursor=0;
 const {PropertyWhatsAppButton}=compile('components/PropertyWhatsAppButton.tsx',{react:{useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=v];},useEffect(fn){effects.push(fn);}},'@/lib/properties/property-whatsapp':contactsApi});
 const props={propertyId:'property-1',title:'Casa',contact:{whatsappNumber:'5493581234567',message:'Quiero conversar'}};
 const render=()=>{cursor=0;return PropertyWhatsAppButton(props);};assert.equal(render(),null);
 const before=globalThis.window;globalThis.window={location:{origin:'https://example.test'}};
 try{effects[0]();const button=render();assert.equal(button.type,'a');assert.equal(button.props.target,'_blank');assert.equal(button.props.rel,'noopener noreferrer');assert.equal(new URL(button.props.href).searchParams.get('text'),'Quiero conversar\n\nPropiedad: Casa\nhttps://example.test/explorar-propiedades/property-1');
 props.contact=undefined;assert.equal(render(),null);
 }finally{if(before===undefined)delete globalThis.window;else globalThis.window=before;}
});
test('property contact editor is a separate capability without enabling the old editable form provider',()=>{
 const manager=readFileSync(new URL('../components/auth/PropertyManager.tsx',import.meta.url),'utf8');assert.match(manager,/canManagePropertyContact&&<PropertyContactForm/);
 const form=readFileSync(new URL('../components/auth/PropertyContactForm.tsx',import.meta.url),'utf8');assert.doesNotMatch(form,/<EditableForm/);assert.match(form,/savePropertyContactAction/);assert.match(form,/isPublished\?<PropertyWhatsAppButton/);
 const page=readFileSync(new URL('../app/inmobiliaria/[agencyId]/panel/propiedades/page.tsx',import.meta.url),'utf8');assert.match(page,/canManagePropertyContact=canEdit\|\|\['OWNER','ADMIN'\]/);
});

const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
test('contact editor submits the chosen property number/message once and keeps pending inputs disabled',async()=>{
 const slots=[];let cursor=0,resolve;const calls=[];
 const {PropertyContactForm}=compile('components/auth/PropertyContactForm.tsx',{
  react:{useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>slots[i]=value];},useRef(initial){const i=cursor++;return slots[i]??={current:initial};}},
  '@/app/inmobiliaria/[agencyId]/panel/propiedades/contact-actions':{savePropertyContactAction:(slug,data)=>{calls.push({slug,data});return new Promise(done=>{resolve=done;});}},
  '../PropertyWhatsAppButton':{PropertyWhatsAppButton:'whatsapp-preview'},
 });
 const props={agencySlug:'owner-agency',propertyId:'property-1',title:'Casa',isPublished:true};
 const render=()=>{cursor=0;return PropertyContactForm(props);};
 nodes(render()).find(node=>node.type==='input').props.onChange({target:{value:'+54 9 358 1234567'}});
 nodes(render()).find(node=>node.type==='textarea').props.onChange({target:{value:'Mi mensaje {enlace}'}});
 const submit=()=>nodes(render()).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
 submit();submit();assert.equal(calls.length,1);assert.equal(nodes(render()).find(node=>node.type==='fieldset').props.disabled,true);
 assert.equal(calls[0].slug,'owner-agency');assert.equal(calls[0].data.get('propertyId'),'property-1');assert.equal(calls[0].data.get('whatsappNumber'),'+54 9 358 1234567');assert.equal(calls[0].data.get('message'),'Mi mensaje {enlace}');
 resolve({success:'Guardado'});await new Promise(done=>setImmediate(done));assert.equal(nodes(render()).find(node=>node.type==='fieldset').props.disabled,false);
});
