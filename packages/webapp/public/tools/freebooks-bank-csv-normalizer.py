#!/usr/bin/env python3
"""Normalize a bank/card CSV to FreeBooks import columns; standard library only."""
import argparse,csv,datetime as dt,decimal,os,pathlib,re,sys
ALIASES={
"date":["date","transaction date","posted date","date posted","posting date"],
"amount":["amount","transaction amount","net amount"],
"debit":["debit","debit amount","withdrawal","withdrawals","money out","outflow"],
"credit":["credit","credit amount","deposit","deposits","money in","inflow"],
"payee":["payee","merchant","merchant name","name","counterparty"],
"description":["description","transaction description","details","memo","transaction"],
"reference":["reference","reference number","reference no","transaction id","check number","confirmation number"]}
def norm(v): return re.sub(r"[^a-z0-9]+"," ",(v or "").strip().lower()).strip()
def read_rows(p):
 try: text=p.read_text(encoding="utf-8-sig")
 except UnicodeDecodeError: text=p.read_text(encoding="cp1252")
 try: dialect=csv.Sniffer().sniff(text[:8192],delimiters=",;\t|")
 except csv.Error: dialect=csv.excel
 return list(csv.DictReader(text.splitlines(),dialect=dialect))
def col(headers,field,requested):
 if requested:
  found=[h for h in headers if norm(h)==norm(requested)]
  if len(found)!=1: raise ValueError("Could not uniquely match requested "+field+" column.")
  return found[0]
 found=[h for h in headers if norm(h) in {norm(x) for x in ALIASES[field]}]
 if len(found)>1: raise ValueError("Multiple "+field+" columns; pass --"+field+"-column.")
 return found[0] if found else None
def date(v,fmt):
 for f in ([fmt] if fmt else ["%Y-%m-%d","%Y/%m/%d","%m/%d/%Y","%m/%d/%y","%m-%d-%Y","%m-%d-%y"]):
  try: return dt.datetime.strptime((v or "").strip(),f).date().isoformat()
  except (ValueError,TypeError): pass
 raise ValueError("invalid date")
def money(v):
 x=(v or "").strip()
 if not x: return decimal.Decimal("0")
 neg=x.startswith("(") and x.endswith(")")
 x=x.strip("()").replace(",","").replace("$","").replace("USD","").strip().replace("−","-")
 if x.endswith("-"): x="-"+x[:-1]
 try: n=decimal.Decimal(x)
 except decimal.InvalidOperation: raise ValueError("invalid amount")
 return -abs(n) if neg else n
def main():
 p=argparse.ArgumentParser(description="Convert a bank/card CSV to FreeBooks import columns.")
 p.add_argument("input_csv",type=pathlib.Path); p.add_argument("output_csv",type=pathlib.Path)
 for n in ("date","amount","debit","credit","payee","description","reference"): p.add_argument("--"+n+"-column")
 p.add_argument("--date-format",help="Python format, e.g. %%m/%%d/%%Y")
 p.add_argument("--invert-signs",action="store_true",help="Reverse amounts if provider marks spending positive.")
 p.add_argument("--overwrite",action="store_true"); a=p.parse_args()
 src=a.input_csv.resolve(); out=a.output_csv.resolve()
 if src==out: p.error("Input and output must differ.")
 if not src.is_file(): p.error("Input CSV does not exist.")
 if out.exists() and not a.overwrite: p.error("Output exists; choose another name or pass --overwrite.")
 try:
  rows=read_rows(src)
  if not rows: raise ValueError("CSV has no data rows.")
  hs=list(rows[0].keys())
  if not hs or any(h is None for h in hs): raise ValueError("Malformed CSV header.")
  d=col(hs,"date",a.date_column); amt=col(hs,"amount",a.amount_column)
  debit=col(hs,"debit",a.debit_column); credit=col(hs,"credit",a.credit_column)
  pay=col(hs,"payee",a.payee_column); desc=col(hs,"description",a.description_column); ref=col(hs,"reference",a.reference_column)
  if not d: raise ValueError("Date column not detected; pass --date-column.")
  if not amt and not (debit and credit): raise ValueError("Amount or debit/credit columns not detected; pass column options.")
  data=[]; errors=[]
  for i,row in enumerate(rows,2):
   if not any((v or "").strip() for v in row.values() if isinstance(v,str)): continue
   try:
    day=date(row.get(d),a.date_format)
    value=money(row.get(amt)) if amt else money(row.get(credit))-money(row.get(debit))
    if a.invert_signs: value=-value
    value=value.quantize(decimal.Decimal("0.01"))
   except ValueError as e: errors.append((i,str(e))); continue
   merchant=(row.get(pay) or "").strip() if pay else ""
   memo=(row.get(desc) or "").strip() if desc else ""
   if not merchant: merchant=memo
   if not memo: memo=merchant
   data.append({"Amount":format(value,".2f"),"Date":day,"Payee":merchant,"Reference No.":(row.get(ref) or "").strip() if ref else "","Description":memo})
  if errors: raise ValueError(str(len(errors))+" row(s) need correction: "+", ".join("row "+str(i)+" ("+e+")" for i,e in errors[:12]))
  if not data: raise ValueError("No transaction rows found.")
  out.parent.mkdir(parents=True,exist_ok=True); tmp=out.with_name(out.name+".tmp")
  with tmp.open("w",newline="",encoding="utf-8-sig") as f:
   w=csv.DictWriter(f,fieldnames=["Amount","Date","Payee","Reference No.","Description"]); w.writeheader(); w.writerows(data)
  os.replace(tmp,out)
  print("Created "+str(len(data))+" import row(s): "+str(out))
  print("Review dates and amount signs in FreeBooks before committing; source unchanged.")
  return 0
 except (OSError,csv.Error,ValueError) as e:
  print("Import preparation stopped: "+str(e),file=sys.stderr); return 2
if __name__=="__main__": raise SystemExit(main())
