"""Genera los atajos de MANU para el iPhone (WEB-88).

Ninguno lleva el código privado del buzón: el iPhone lo pregunta al añadir
cada atajo que lo necesita. La URL y la clave publishable son públicas
(están en web/app.js).

Estado:
- MANU Dinero: COMPROBADO en el iPhone de Manu (2026-10-05).
- MANU Dictado, MANU Apuntar, MANU Recordatorio: NO_VERIFICADOS.

Uso:
  python3 tools/shortcuts/atajos.py CARPETA        # escribe un .shortcut por atajo
  # en un Mac, dentro de CARPETA:
  mkdir -p firmados && for f in *.shortcut; do shortcuts sign --mode anyone --input "$f" --output "firmados/$f"; done
"""
import os
import plistlib
import sys
import uuid

URL = "https://xqsexjpuhvmwkclpnvjo.supabase.co/rest/v1/manu_inbox"
KEY = "sb_publishable_sfml3vmi8c7Un7kTi4xjkg_Ioj1eAwQ"
DATE_FMT = "yyyy-MM-dd HH:mm"
OBJ = "￼"
QUESTION = "Pega tu código del atajo (MANU → Tú → Atajos → «Copiar código»)"


def U():
    return str(uuid.uuid4()).upper()


def att(uid, name):
    return {"OutputUUID": uid, "OutputName": name, "Type": "ActionOutput"}


def tok(uid, name):
    return {"Value": att(uid, name), "WFSerializationType": "WFTextTokenAttachment"}


def tstr(parts):
    s, rng = "", {}
    for p in parts:
        if isinstance(p, str):
            s += p
        else:
            rng["{%d, 1}" % (len(s.encode("utf-16-le")) // 2)] = p
            s += OBJ
    return {"Value": {"string": s, "attachmentsByRange": rng}, "WFSerializationType": "WFTextTokenString"}


def dic(items):
    return {"Value": {"WFDictionaryFieldValueItems": [{"WFItemType": 0, "WFKey": tstr([k]), "WFValue": tstr(v)} for k, v in items]},
            "WFSerializationType": "WFDictionaryFieldValue"}


class Shortcut:
    def __init__(self, name, color, glyph):
        self.name, self.color, self.glyph = name, color, glyph
        self.actions, self.questions = [], []

    def act(self, ident, params):
        self.actions.append({"WFWorkflowActionIdentifier": ident, "WFWorkflowActionParameters": params})
        return params.get("UUID")

    def code(self):
        """The private code, asked by the iPhone on import (never stored here)."""
        uid = U()
        self.questions.append({"ActionIndex": len(self.actions), "Category": "Parameter", "DefaultValue": "",
                               "ParameterKey": "WFTextActionText", "Text": QUESTION})
        self.act("is.workflow.actions.gettext", {"UUID": uid, "WFTextActionText": tstr(["PEGA_AQUI_TU_CODIGO"])})
        return uid

    def date(self):
        uid = U()
        self.act("is.workflow.actions.format.date", {"UUID": uid, "WFDateFormatStyle": "Custom", "WFDateFormat": DATE_FMT,
                                                     "WFDate": tstr([{"Type": "CurrentDate"}])})
        return uid

    def send(self, code_uid, line_attachment):
        self.act("is.workflow.actions.downloadurl", {"UUID": U(), "WFURL": URL, "WFHTTPMethod": "POST", "ShowHeaders": True,
                 "WFHTTPHeaders": dic([("apikey", [KEY]), ("Prefer", ["return=minimal"])]),
                 "WFHTTPBodyType": "JSON", "WFJSONValues": dic([("token", [att(code_uid, "Texto")]), ("line", [line_attachment])])})
        self.act("is.workflow.actions.notification", {"WFNotificationActionTitle": "MANU", "WFNotificationActionBody": "Apuntado ✅"})

    def plist(self):
        return {"WFWorkflowClientVersion": "2302.0.4", "WFWorkflowMinimumClientVersion": 900, "WFWorkflowMinimumClientVersionString": "900",
                "WFWorkflowIcon": {"WFWorkflowIconStartColor": self.color, "WFWorkflowIconGlyphNumber": self.glyph},
                "WFWorkflowImportQuestions": self.questions, "WFWorkflowInputContentItemClasses": ["WFStringContentItem"],
                "WFWorkflowTypes": [], "WFWorkflowOutputContentItemClasses": [], "WFWorkflowHasOutputFallback": False,
                "WFQuickActionSurfaces": [], "WFWorkflowActions": self.actions}


SPEND = ["Bar", "Comida", "Discoteca", "Supermercado", "Gasolina", "Transporte", "Tabaco", "Ropa", "Ocio", "Casa", "Salud", "Suscripciones", "Regalos", "Otros"]
INCOME = ["Nómina", "Manutención", "Familia", "Bizum", "Venta", "Otros"]


def dinero():
    sc = Shortcut("MANU Dinero", 431817727, 59446)
    code = sc.code()
    g, end = U(), U()
    sc.act("is.workflow.actions.choosefrommenu", {"GroupingIdentifier": g, "WFControlFlowMode": 0, "WFMenuPrompt": "¿Gasto o ingreso?", "WFMenuItems": ["Gasto", "Ingreso"]})
    for title, kind, items, ask in (("Gasto", "gasto", SPEND, "¿De qué?"), ("Ingreso", "ingreso", INCOME, "¿De dónde?")):
        sc.act("is.workflow.actions.choosefrommenu", {"GroupingIdentifier": g, "WFControlFlowMode": 1, "WFMenuItemTitle": title})
        n = sc.act("is.workflow.actions.ask", {"UUID": U(), "WFAskActionPrompt": "¿Cuánto?", "WFInputType": "Number"})
        lst = sc.act("is.workflow.actions.list", {"UUID": U(), "WFItems": items})
        ch = sc.act("is.workflow.actions.choosefromlist", {"UUID": U(), "WFInput": tok(lst, "Lista"), "WFChooseFromListActionPrompt": ask})
        d = sc.date()
        sc.act("is.workflow.actions.gettext", {"UUID": U(), "WFTextActionText": tstr([kind + "|", att(d, "Fecha formateada"), "|", att(n, "Entrada proporcionada"), "|", att(ch, "Elemento elegido"), "|"])})
    sc.act("is.workflow.actions.choosefrommenu", {"GroupingIdentifier": g, "WFControlFlowMode": 2, "UUID": end})
    sc.send(code, att(end, "Elegir del menú"))
    return sc


def nota(name, color, glyph, dictate):
    sc = Shortcut(name, color, glyph)
    code = sc.code()
    if dictate:
        said = sc.act("is.workflow.actions.dictatetext", {"UUID": U()})
        said_att = att(said, "Texto dictado")
    else:
        said = sc.act("is.workflow.actions.ask", {"UUID": U(), "WFAskActionPrompt": "¿Qué apunto?", "WFInputType": "Text"})
        said_att = att(said, "Entrada proporcionada")
    d = sc.date()
    line = sc.act("is.workflow.actions.gettext", {"UUID": U(), "WFTextActionText": tstr(["nota|", att(d, "Fecha formateada"), "|", said_att])})
    sc.send(code, att(line, "Texto"))
    return sc


def recordatorio():
    """MANU opens it with «texto | 2026-10-06 10:00» (shortcuts://run-shortcut)."""
    sc = Shortcut("MANU Recordatorio", 4282601983, 59511)
    parts = sc.act("is.workflow.actions.text.split", {"UUID": U(), "text": tstr([{"Type": "ExtensionInput"}]), "WFTextSeparator": "Custom", "WFTextCustomSeparator": "|"})
    first = sc.act("is.workflow.actions.getitemfromlist", {"UUID": U(), "WFInput": tok(parts, "Texto dividido"), "WFItemSpecifier": "First Item"})
    last = sc.act("is.workflow.actions.getitemfromlist", {"UUID": U(), "WFInput": tok(parts, "Texto dividido"), "WFItemSpecifier": "Last Item"})
    when = sc.act("is.workflow.actions.detect.date", {"UUID": U(), "WFInput": tok(last, "Elemento de la lista")})
    sc.act("is.workflow.actions.addnewreminder", {"UUID": U(), "WFCalendarItemTitle": tstr([att(first, "Elemento de la lista")]),
                                                  "WFAlertEnabled": "Alert", "WFAlertCustomTime": tstr([att(when, "Fechas")])})
    return sc


ALL = [dinero, lambda: nota("MANU Dictado", 2071128575, 59797, True), lambda: nota("MANU Apuntar", 463140863, 59654, False), recordatorio]

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out, exist_ok=True)
    for build in ALL:
        sc = build()
        with open(os.path.join(out, sc.name + ".shortcut"), "wb") as fh:
            fh.write(plistlib.dumps(sc.plist(), fmt=plistlib.FMT_BINARY))
        print(f"{sc.name}: {len(sc.actions)} acciones")
