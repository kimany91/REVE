# REVE pour NumWorks - genere par l'application REVE
# Ecran de calcul. La touche REVE ouvre les fiches, la meme touche les referme.
from kandinsky import fill_rect as R, draw_string as S
from ion import keydown as K
from time import sleep
from math import *
import ion
#__DATA__
W=(255,255,255);N=(30,30,40);G=(120,120,130);LG=(232,232,238);OR=(255,183,52)
SC=[(46,92,201),(214,64,64),(0,140,90),(140,70,190),(230,120,0),(0,130,170)]
CO=[(46,110,230),(214,50,50),(140,70,190),(0,150,80),(235,130,0),(110,110,120)]
LB=["DEF","FORM","LOI","METH","EX","INFO"]
KM={ion.KEY_ZERO:"0",ion.KEY_ONE:"1",ion.KEY_TWO:"2",ion.KEY_THREE:"3",ion.KEY_FOUR:"4",
ion.KEY_FIVE:"5",ion.KEY_SIX:"6",ion.KEY_SEVEN:"7",ion.KEY_EIGHT:"8",ion.KEY_NINE:"9",
ion.KEY_DOT:".",ion.KEY_PLUS:"+",ion.KEY_MINUS:"-",ion.KEY_MULTIPLICATION:"*",
ion.KEY_DIVISION:"/",ion.KEY_LEFTPARENTHESIS:"(",ion.KEY_RIGHTPARENTHESIS:")",
ion.KEY_POWER:"^",ion.KEY_SQUARE:"^2",ion.KEY_SQRT:"sqrt(",ion.KEY_PI:"pi",
ion.KEY_EXP:"exp(",ion.KEY_LN:"ln(",ion.KEY_LOG:"log(",ion.KEY_SINE:"sin(",
ion.KEY_COSINE:"cos(",ion.KEY_TANGENT:"tan(",ion.KEY_EE:"E",ion.KEY_ANS:"Ans",
ion.KEY_COMMA:","}
NAV=[ion.KEY_UP,ion.KEY_DOWN,ion.KEY_LEFT,ion.KEY_RIGHT,ion.KEY_OK,ion.KEY_EXE,
ion.KEY_BACKSPACE,KREVE]
ALL=list(KM.keys())+NAV
NL=10

def key():
  while 1:
    for k in ALL:
      if K(k):
        n=0
        while K(k) and n<35:
          sleep(0.01);n+=1
        return k
    sleep(0.01)

def bar(t,c,r=""):
  R(0,0,320,20,c)
  S(t[:31-len(r)],4,1,W,c)
  if r:S(r,316-10*len(r),1,W,c)

def foot(t):
  R(0,204,320,18,LG)
  S(t[:32],160-5*len(t[:32]),204,G,LG)

def lg(x):
  return log(x)/log(10)

def fmt(v):
  if isinstance(v,float):
    if v==int(v) and abs(v)<1e15:
      return str(int(v))
    return "%.10g"%v
  return str(v)

def calc(e,a):
  s=e.replace("^","**").replace("log(","lg(").replace("ln(","log(")
  s=s.replace("E","*10**").replace("Ans","("+a+")")
  try:
    return fmt(eval(s))
  except:
    return "Erreur"

def drawcalc(h,e):
  R(0,0,320,222,W)
  bar("REVE  calculs",OR,KN)
  y=158
  i=len(h)-1
  while i>=0 and y>=40:
    x,r=h[i]
    S(x[-31:],4,y-18,G,W)
    S(r[-31:],316-10*len(r[-31:]),y,N,W)
    R(0,y-21,320,1,LG)
    y-=40;i-=1
  R(0,180,320,2,OR)
  S((e+"_")[-31:],4,184,N,W)
  foot(KN+": fiches  <x: effacer")

def liste(titre,c,items,s):
  # menu : fleches + OK ; touche REVE = retour au calcul
  while 1:
    R(0,0,320,222,W)
    bar(titre,c,str(s+1)+"/"+str(len(items)))
    a=max(0,min(s-4,len(items)-9))
    y=22
    for i in range(a,min(a+9,len(items))):
      if i==s:
        R(0,y,320,20,c)
        S(items[i][:31],6,y+1,W,c)
      else:
        S(items[i][:31],6,y+1,N,W)
        R(6,y+19,308,1,LG)
      y+=20
    foot("OK: ouvrir  "+KN+": calcul")
    k=key()
    if k==ion.KEY_UP:s=(s-1)%len(items)
    elif k==ion.KEY_DOWN:s=(s+1)%len(items)
    elif k in (ion.KEY_OK,ion.KEY_EXE,ion.KEY_RIGHT):return s
    elif k==KREVE:return -1
    elif k in (ion.KEY_BACKSPACE,ion.KEY_LEFT):return -2

def drawpage(c,o):
  sc=SC[CS[c]%len(SC)]
  R(0,0,320,222,W)
  bar(SN[CS[c]],sc,str(c+1)+"/"+str(len(T)))
  ls=L[c]
  y=22
  for i in range(o,min(o+NL,len(ls))):
    l=ls[i];d=l[0]
    if d in "012345":
      j=int(d)
      R(0,y+1,38,16,CO[j])
      S(LB[j][:4],19-5*len(LB[j][:4]),y,W,CO[j])
      S(l[1:],42,y,N,W)
    elif d=="#":
      S(l[1:],4,y,sc,W)
      R(4,y+18,312,1,sc)
    else:
      S(l[1:],42,y,N,W)
    y+=18
  n=len(ls)
  if n>NL:
    hb=max(12,180*NL//n)
    R(316,22+(180-hb)*o//(n-NL),4,hb,G)
  foot("<> chapitre  ^v lire  OK menu")

def fiches(st):
  c,o=st
  if c<0:
    m=0
    while 1:
      if len(SN)>1:
        m=liste("REVE : matieres",OR,SN,max(m,0))
        if m<0:return st
      ch=[i for i in range(len(T)) if CS[i]==m]
      s=liste(SN[m],SC[m%len(SC)],[T[i] for i in ch],0)
      if s==-1:return st
      if s>=0:
        c=ch[s];o=0;break
      if len(SN)==1:return st
  while 1:
    drawpage(c,o)
    k=key()
    n=len(L[c])
    if k==KREVE:return [c,o]
    elif k==ion.KEY_DOWN and o<n-NL:o=min(n-NL,o+NL-1)
    elif k==ion.KEY_UP and o>0:o=max(0,o-NL+1)
    elif k==ion.KEY_RIGHT:
      c=(c+1)%len(T);o=0
    elif k==ion.KEY_LEFT:
      c=(c-1)%len(T);o=0
    elif k in (ion.KEY_OK,ion.KEY_EXE):
      m=CS[c]
      ch=[i for i in range(len(T)) if CS[i]==m]
      s=liste(SN[m],SC[m%len(SC)],[T[i] for i in ch],ch.index(c))
      if s==-1:return [c,o]
      if s>=0:
        c=ch[s];o=0

def main():
  h=[];e="";a="0";st=[-1,0]
  while 1:
    drawcalc(h,e)
    k=key()
    if k==KREVE:
      st=fiches(st)
    elif k in KM:
      e+=KM[k]
    elif k==ion.KEY_BACKSPACE:
      if e:
        for m in ("sqrt(","sin(","cos(","tan(","exp(","log(","ln(","Ans","pi","^2"):
          if e.endswith(m):
            e=e[:-len(m)];break
        else:
          e=e[:-1]
      else:
        h=[]
    elif k in (ion.KEY_EXE,ion.KEY_OK) and e:
      r=calc(e,a)
      if r!="Erreur":a=r
      h.append((e,r));h=h[-4:];e=""

main()
