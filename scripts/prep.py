import sys
from PIL import Image, ImageOps, ImageFilter
import numpy as np
U='/mnt/user-data/uploads/'
A='/home/claude/m-sport/assets/'
def alpha_from(path, invert, color, out, maxw=900):
    im=Image.open(U+path).convert('L')
    a=np.array(im).astype(float)
    if invert: a=255-a   # dark lines on white -> alpha from darkness
    # contrast stretch
    a=np.clip((a-25)*255/(230-25),0,255).astype('uint8')
    rgba=np.zeros((*a.shape,4),dtype='uint8'); rgba[...,:3]=color; rgba[...,3]=a
    img=Image.fromarray(rgba,'RGBA')
    bb=img.getbbox(); img=img.crop(bb)
    if img.width>maxw: img=img.resize((maxw,round(img.height*maxw/img.width)),Image.LANCZOS)
    img.save(A+out,optimize=True); print(out,img.size)
alpha_from('Boulder_Corp_Logo_1.jpg',False,(255,255,255),'boulder-blanco.png')
alpha_from('WhatsApp_Image_2026-10-19_at_3_54_56p_m_.jpeg',False,(255,255,255),'porfirio-blanco.png')
alpha_from('WhatsApp_Image_2026-10-18_at_2_01_41p_m_.jpeg',True,(17,17,17),'aluxes-negro.png',700)
alpha_from('WhatsApp_Image_2026-10-18_at_2_01_41p_m_.jpeg',True,(255,255,255),'aluxes-blanco.png',700)
for c,n in (('blanco','moon-blanco.png'),('negro','moon-negro.png')):
    im=Image.open(U+f'MOON-Digital-logo-horizontal-{c}.png'); im=im.crop(im.getbbox()); im=im.resize((1100,round(im.height*1100/im.width)),Image.LANCZOS); im.save(A+n,optimize=True); print(n,im.size)
# textures
im=Image.open(U+'1792450375543_image.png').convert('RGB')
im.crop((300,320,960,960)).resize((900,872),Image.LANCZOS).save(A+'tela-lila.jpg',quality=88); 
im2=Image.open(U+'IMG_4308.JPG'); im2=ImageOps.exif_transpose(im2).convert('RGB'); print('4308',im2.size)
im2.save('/home/claude/m-sport/scripts/4308.jpg',quality=70)
