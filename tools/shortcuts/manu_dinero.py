"""Genera el atajo «MANU Dinero» (WEB-87).

Comprobado en el iPhone de Manu el 2026-10-05: gasto de prueba recibido en MANU.
El código del atajo NO va aquí: el iPhone lo pregunta al añadir el atajo.

Uso:
  python3 tools/shortcuts/manu_dinero.py ~/Downloads/MANU-Dinero.shortcut
  # en un Mac:
  shortcuts sign --mode anyone --input ~/Downloads/MANU-Dinero.shortcut --output ~/Downloads/MANU-Dinero-firmado.shortcut
Luego AirDrop al iPhone. La URL y la clave publishable son públicas (están en web/app.js).
"""
import sys
import plistlib, uuid
U=lambda: str(uuid.uuid4()).upper()
OBJ="￼"
def att(uid,name): return {"OutputUUID":uid,"OutputName":name,"Type":"ActionOutput"}
def tok(uid,name): return {"Value":att(uid,name),"WFSerializationType":"WFTextTokenAttachment"}
def tstr(parts):
    s="";rng={}
    for p in parts:
        if isinstance(p,str): s+=p
        else:
            pos=len(s.encode("utf-16-le"))//2; rng["{%d, 1}"%pos]=p; s+=OBJ
    return {"Value":{"string":s,"attachmentsByRange":rng},"WFSerializationType":"WFTextTokenString"}
def dic(items):
    return {"Value":{"WFDictionaryFieldValueItems":[{"WFItemType":0,"WFKey":tstr([k]),"WFValue":tstr(v)} for k,v in items]},"WFSerializationType":"WFDictionaryFieldValue"}
A=[]
def act(ident,params): A.append({"WFWorkflowActionIdentifier":ident,"WFWorkflowActionParameters":params})
code=U()
act("is.workflow.actions.gettext",{"UUID":code,"WFTextActionText":tstr(["PEGA_AQUI_TU_CODIGO"])})
g=U(); menuEnd=U()
act("is.workflow.actions.choosefrommenu",{"GroupingIdentifier":g,"WFControlFlowMode":0,"WFMenuPrompt":"¿Gasto o ingreso?","WFMenuItems":["Gasto","Ingreso"]})
def branch(title,kind,items,ask):
    act("is.workflow.actions.choosefrommenu",{"GroupingIdentifier":g,"WFControlFlowMode":1,"WFMenuItemTitle":title})
    n=U(); act("is.workflow.actions.ask",{"UUID":n,"WFAskActionPrompt":"¿Cuánto?","WFInputType":"Number"})
    l=U(); act("is.workflow.actions.list",{"UUID":l,"WFItems":items})
    c=U(); act("is.workflow.actions.choosefromlist",{"UUID":c,"WFInput":tok(l,"Lista"),"WFChooseFromListActionPrompt":ask})
    d=U(); act("is.workflow.actions.format.date",{"UUID":d,"WFDateFormatStyle":"Custom","WFDateFormat":"yyyy-MM-dd HH:mm","WFDate":tstr([{"Type":"CurrentDate"}])})
    t=U(); act("is.workflow.actions.gettext",{"UUID":t,"WFTextActionText":tstr([kind+"|",att(d,"Fecha formateada"),"|",att(n,"Entrada proporcionada"),"|",att(c,"Elemento elegido"),"|"])})
branch("Gasto","gasto",["Bar","Comida","Discoteca","Supermercado","Gasolina","Transporte","Tabaco","Ropa","Ocio","Casa","Salud","Suscripciones","Regalos","Otros"],"¿De qué?")
branch("Ingreso","ingreso",["Nómina","Manutención","Familia","Bizum","Venta","Otros"],"¿De dónde?")
act("is.workflow.actions.choosefrommenu",{"GroupingIdentifier":g,"WFControlFlowMode":2,"UUID":menuEnd})
r=U()
act("is.workflow.actions.downloadurl",{"UUID":r,"WFURL":"https://xqsexjpuhvmwkclpnvjo.supabase.co/rest/v1/manu_inbox","WFHTTPMethod":"POST","ShowHeaders":True,
  "WFHTTPHeaders":dic([("apikey",["sb_publishable_sfml3vmi8c7Un7kTi4xjkg_Ioj1eAwQ"]),("Prefer",["return=minimal"])]),
  "WFHTTPBodyType":"JSON","WFJSONValues":dic([("token",[att(code,"Texto")]),("line",[att(menuEnd,"Elegir del menú")])])})
act("is.workflow.actions.notification",{"WFNotificationActionTitle":"MANU","WFNotificationActionBody":"Apuntado ✅"})
wf={"WFWorkflowClientVersion":"2302.0.4","WFWorkflowMinimumClientVersion":900,"WFWorkflowMinimumClientVersionString":"900",
 "WFWorkflowIcon":{"WFWorkflowIconStartColor":431817727,"WFWorkflowIconGlyphNumber":59446},
 "WFWorkflowImportQuestions":[{"ActionIndex":0,"Category":"Parameter","DefaultValue":"","ParameterKey":"WFTextActionText","Text":"Pega tu código del atajo (MANU → Tú → Atajos → «Copiar código»)"}],
 "WFWorkflowInputContentItemClasses":["WFStringContentItem"],"WFWorkflowTypes":[],"WFWorkflowOutputContentItemClasses":[],"WFWorkflowHasOutputFallback":False,"WFQuickActionSurfaces":[],
 "WFWorkflowActions":A}
out = sys.argv[1] if len(sys.argv) > 1 else "MANU-Dinero.shortcut"
open(out, "wb").write(plistlib.dumps(wf, fmt=plistlib.FMT_BINARY))
print(f"{len(A)} acciones → {out}")
