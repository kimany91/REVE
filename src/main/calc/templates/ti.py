# REVE pour TI-83 Premium CE - genere par l'application REVE
# Ecran de calcul + mode revision (touche REVE pour ouvrir/fermer)
from ti_draw import *
from ti_system import *
from math import *
try:
  from ti_draw import use_buffer,paint_buffer
  use_buffer()
except:
  def paint_buffer():
    pass
#__DATA__
CO=[(0,90,200),(200,30,30),(130,50,170),(0,140,70),(220,120,0),(70,70,70)]
LB=["DEF","FORM","LOI","METH","EX",">"]
# codes touches : famille getKey et famille systeme (selon la version de l'OS)
KM={102:"0",92:"1",93:"2",94:"3",82:"4",83:"5",84:"6",72:"7",73:"8",74:"9",
103:".",104:"-",95:"+",85:"-",75:"*",65:"/",55:"^",63:"(",64:")",61:"^2",
52:"sin(",53:"cos(",54:"tan(",71:"log(",81:"ln(",62:",",
142:"0",143:"1",144:"2",145:"3",146:"4",147:"5",148:"6",149:"7",150:"8",151:"9",
141:".",140:"-",128:"+",129:"-",130:"*",131:"/",132:"^",133:"(",134:")",139:","}
ENT=(105,5);CLR=(45,9);DEL=(23,10);UP=(25,3);DN=(34,4);LF=(24,2);RT=(26,1)
SYS=ENT+CLR+DEL+UP+DN+LF+RT+(21,31,48,49)

def col(c):
  set_color(c[0],c[1],c[2])

def box(x,y,w,h,c):
  col(c);fill_rect(x,y,w,h)

def txt(x,y,s,c):
  col(c);draw_text(x,y,s)

def lg(x):
  return log(x)/log(10)

def fmt(v):
  if isinstance(v,float):
    if v==int(v) and abs(v)<1e15:
      return str(int(v))
    return "%.10g"%v
  return str(v)

def calc(e,a):
  s=e.replace("^","**").replace("log(","lg(").replace("ln(","log(").replace("Ans","("+a+")")
  try:
    return fmt(eval(s))
  except:
    return "Erreur"

def drawcalc(h,e,k):
  box(0,0,320,210,(255,255,255))
  box(0,0,320,18,(40,40,40))
  txt(4,2,"CALCULS",(255,255,255))
  if k<0:
    txt(150,2,"REVE: [math]",(255,200,60))
  y=150
  i=len(h)-1
  while i>=0 and y>=40:
    x,r=h[i]
    txt(4,y-18,x[-28:],(110,110,110))
    txt(150,y,"= "+r[-14:],(0,0,0))
    y-=38;i-=1
  box(0,182,320,1,(110,110,110))
  txt(4,188,e[-28:]+"_",(0,0,0))
  paint_buffer()

def drawrev(c,o):
  box(0,0,320,210,(255,255,255))
  box(0,0,320,18,(46,92,201))
  p=str(c+1)+"/"+str(len(T))
  txt(4,2,T[c][:27-len(p)],(255,255,255))
  txt(286-6*len(p),2,p,(255,255,255))
  ls=L[c]
  y=21
  for i in range(o,min(o+11,len(ls))):
    l=ls[i];d=l[0]
    if d in "012345":
      j=int(d)
      txt(0,y,LB[j],CO[j])
      txt(42,y,l[1:],(0,0,0))
    elif d=="#":
      txt(0,y,l[1:],(46,92,201))
    else:
      txt(42,y,l[1:],(0,0,0))
    y+=17
  n=len(ls)
  if n>11:
    hb=max(10,187*11//n)
    box(316,21+(187-hb)*o//(n-11),4,hb,(110,110,110))
  paint_buffer()

def revise(st,rk):
  c,o=st
  while 1:
    drawrev(c,o)
    k=wait_key()
    n=len(L[c])
    if k==rk or k in CLR:return [c,o]
    elif k in DN and o<n-11:o+=1
    elif k in UP and o>0:o-=1
    elif k in RT:
      c=(c+1)%len(T);o=0
    elif k in LF:
      c=(c-1)%len(T);o=0

def main():
  h=[];e="";a="0";st=[0,0];rk=KREVE
  while 1:
    drawcalc(h,e,rk)
    k=wait_key()
    if rk<0 and k not in KM and k not in SYS:
      rk=k
    if k==rk:
      st=revise(st,rk)
    elif k in KM:
      e+=KM[k]
    elif k in DEL:
      e=e[:-1]
    elif k in CLR:
      if e:e=""
      else:break
    elif k in ENT and e:
      r=calc(e,a)
      if r!="Erreur":a=r
      h.append((e,r));h=h[-4:];e=""
  clear()

main()
