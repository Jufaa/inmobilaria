import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const out={};const code=ts.transpileModule(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;new Function('require','exports',code)(id=>mocks[id]??(id.endsWith('.module.css')?{__esModule:true,default:{}}:require(id)),out);return out;}
const nodes=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];
const text=t=>t==null||typeof t==='boolean'?'':typeof t==='string'?t:Array.isArray(t)?t.map(text).join(' '):text(t.props?.children);
const {AgencySectionTabs}=load('components/auth/AgencySectionTabs.tsx',{'next/link':{__esModule:true,default:'a'}});
const common={panelPath:'/panel',activeSection:'map',canManageCollaboration:false,canManageRentals:false};
test('global administrator sees all panels even without agency membership navigation flags',()=>{
 const tree=AgencySectionTabs({...common,canEdit:true,canManageBasic:false});
 for(const label of ['Mapa','Propiedades','Consultas','Estadísticas','Barrios','Colaboración','Alquileres','Personalización','Ofertas'])assert.ok(text(tree).includes(label),label);
 assert.match(text(tree),/Administración/);
});
test('agency sees one Operation group including basic appearance/offers and no Administration panels',()=>{
 const tree=AgencySectionTabs({...common,canEdit:false,canManageBasic:true,canManageCollaboration:true,canManageRentals:true});
 assert.match(text(tree),/Operación/);assert.match(text(tree),/Personalización/);assert.match(text(tree),/Ofertas/);
 assert.doesNotMatch(text(tree),/Administración|Barrios|Colaboración|Alquileres/);
 const readOnly=AgencySectionTabs({...common,canEdit:false,canManageBasic:false});assert.doesNotMatch(text(readOnly),/Personalización|Ofertas|Administración/);
});
test('fullscreen agency shell omits administration and preserves account controls under Operation',()=>{
 const {WorkspaceShell}=load('components/auth/WorkspaceShell.tsx',{'next/link':{__esModule:true,default:'a'},'lucide-react':{Building2:'icon',MapPinned:'icon'},'./GoogleSignOut':{GoogleSignOut:'logout'},'@/components/theme/ThemeToggle':{ThemeToggle:'theme'},'./AgencySectionTabs':{AgencySectionTabs:'tabs'},'./PanelBrandTheme':{PanelBrandTheme:'brand'},'./MapWorkspaceLayout':{MapWorkspaceLayout:'map-layout'},'./WorkspaceEditPermission':{WorkspaceEditPermissionProvider:'permission'}});
 const props={agencyName:'Agency',agencySlug:'own',activeSection:'map',canManageBasic:true,canEdit:false,fullscreenMap:true};
 const tree=WorkspaceShell(props),layout=nodes(tree).find(n=>n.type==='map-layout');
 assert.equal(layout.props.administration,null);assert.ok(nodes(layout.props.operationFooter).some(n=>n.type==='logout'));
 assert.equal(nodes(tree).find(n=>n.type==='permission').props.canEdit,false);
 const admin=nodes(WorkspaceShell({...props,canEdit:true})).find(n=>n.type==='map-layout');assert.ok(admin.props.administration);assert.equal(admin.props.operationFooter,null);
});
