# REVE pour NumWorks - genere par l'application REVE
# Ecran de calcul + mode revision (touche REVE pour ouvrir/fermer)
from kandinsky import fill_rect as R, draw_string as S
from ion import keydown as K
from time import sleep
from math import *
import ion
#__DATA__
W=(255,255,255);N=(0,0,0);G=(110,110,110);LG=(238,238,238);OR=(255,183,52)
BL=(46,92,201)
CO=[(0,90,200),(200,30,30),(130,50,170),(0,140,70),(220,120,0),(70,70,70)]
LB=["DEF ","FORM","LOI ","METH","EX  ","  > "]
KM={ion.KEY_ZERO:"0",ion.KEY_ONE:"1",ion.KEY_TWO:"2",ion.KEY_THREE:"3",ion.KEY_FOUR:"4",
ion.KEY_FIVE:"5",ion.KEY_SIX:"6",ion.KEY_SEVEN:"7",ion.KEY_EIGHT:"8",ion.KEY_NINE:"9",
ion.KEY_DOT:".",ion.KEY_PLUS:"+",ion.KEY_MINUS:"-",ion.KEY_MULTIPLICATION:"*",
ion.KEY_DIVISION:"/",ion.KEY_LEFTPARENTHESIS:"(",ion.KEY_RIGHTPARENTHESIS:")",
ion.KEY_POWER:"^",ion.KEY_SQUARE:"^2",ion.KEY_SQRT:"sqrt(",ion.KEY_PI:"pi",
ion.KEY_EXP:"exp(",ion.KEY_LN:"ln(",ion.KEY_LOG:"log(",ion.KEY_SINE:"sin(",
ion.KEY_COSINE:"cos(",ion.KEY_TANGENT:"tan(",ion.KEY_EE:"E",ion.KEY_ANS:"Ans",
ion.KEY_COMMA:","}
NAV=[ion.KEY_UP,ion.KEY_DOWN,ion.KEY_LEFT,ion.KEY_RIGHT,ion.KEY_OK,ion.KEY_EXE,
ion.KEY_BACKSPACE,ion.KEY_SHIFT,KREVE]
ALL=list(KM.keys())+NAV

def key():
  while 1:
    for k in ALL:
      if K(k):
        n=0
        while K(k) and n<40:
          sleep(0.01);n+=1
        return k
    sleep(0.01)

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
  R(0,0,320,20,OR)
  S("CALCULS",125,1,W,OR)
  y=170
  i=len(h)-1
  while i>=0 and y>=40:
    x,r=h[i]
    S(r[-31:],316-10*len(r[-31:]),y,N,W)
    S(x[-31:],4,y-18,G,W)
    R(0,y-21,320,1,LG)
    y-=40;i-=1
  R(0,192,320,1,G)
  t=e[-30:]+"_"
  S(t,4,198,N,W)

def drawrev(c,o):
  R(0,0,320,222,W)
  R(0,0,320,20,BL)
  t=T[c]
  p=str(c+1)+"/"+str(len(T))
  S(t[:31-len(p)],4,1,W,BL)
  S(p,316-10*len(p),1,W,BL)
  ls=L[c]
  y=22
  for i in range(o,min(o+11,len(ls))):
    l=ls[i]
    d=l[0]
    if d in "012345":
      j=int(d)
      S(LB[j],0,y,CO[j],W)
      S(l[1:],40,y,N,W)
    elif d=="#":
      S(l[1:],0,y,BL,W)
    else:
      S(l[1:],40,y,N,W)
    y+=18
  n=len(ls)
  if n>11:
    hb=max(12,198*11//n)
    R(316,22+(198-hb)*o//(n-11),4,hb,G)

def menu(c):
  s=c
  while 1:
    R(0,0,320,222,W)
    R(0,0,320,20,BL)
    S("CHAPITRES",115,1,W,BL)
    a=max(0,min(s-5,len(T)-11))
    y=22
    for i in range(a,min(a+11,len(T))):
      if i==s:
        R(0,y,320,18,BL)
        S(T[i][:32],0,y,W,BL)
      else:
        S(T[i][:32],0,y,N,W)
      y+=18
    k=key()
    if k==ion.KEY_UP and s>0:s-=1
    elif k==ion.KEY_DOWN and s<len(T)-1:s+=1
    elif k in (ion.KEY_OK,ion.KEY_EXE):return s
    elif k==KREVE or k==ion.KEY_BACKSPACE:return c

def revise(st):
  c,o=st
  while 1:
    drawrev(c,o)
    k=key()
    n=len(L[c])
    if k==KREVE:return [c,o]
    elif k==ion.KEY_DOWN and o<n-11:o+=1
    elif k==ion.KEY_UP and o>0:o-=1
    elif k==ion.KEY_RIGHT:
      c=(c+1)%len(T);o=0
    elif k==ion.KEY_LEFT:
      c=(c-1)%len(T);o=0
    elif k in (ion.KEY_OK,ion.KEY_EXE):
      c=menu(c);o=0

def main():
  h=[];e="";a="0";st=[0,0]
  while 1:
    drawcalc(h,e)
    k=key()
    if k==KREVE:
      st=revise(st)
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
      h.append((e,r));h=h[-5:];e=""

main()
