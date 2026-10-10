"""Generate the application's geometric network icon, with standard library only."""
import pathlib
import struct
import zlib

root = pathlib.Path(__file__).resolve().parents[1] / 'build'
root.mkdir(exist_ok=True)

def inside(x, y, left, top, right, bottom, radius):
    if not (left <= x <= right and top <= y <= bottom):
        return False
    cx = min(max(x, left + radius), right - radius)
    cy = min(max(y, top + radius), bottom - radius)
    return (x-cx)**2 + (y-cy)**2 <= radius**2

def pixel(x, y):
    color = (0, 0, 0, 0)
    if inside(x, y, 12, 12, 500, 500, 92): color = (23, 39, 62, 255)
    if (138 <= x <= 154 and 230 <= y <= 306) or (356 <= x <= 372 and 230 <= y <= 306) or (138 <= x <= 372 and 230 <= y <= 246) or (248 <= x <= 264 and 190 <= y <= 246): color = (139, 186, 233, 255)
    for nx, ny in ((195,110),(85,295),(303,295)):
        if inside(x,y,nx,ny,nx+122,ny+90,14): color=(242,246,252,255)
        if nx+22 <= x <= nx+78 and ny+27 <= y <= ny+35: color=(36,92,181,255)
        if (x-(nx+90))**2+(y-(ny+61))**2 <= 25: color=(88,138,200,255)
    return color

def png(size):
    data=bytearray()
    for y in range(size):
        data.append(0)
        for x in range(size):
            samples=[pixel((x+sx)*512/size,(y+sy)*512/size) for sx,sy in ((.25,.25),(.75,.25),(.25,.75),(.75,.75))]
            data.extend(sum(p[c] for p in samples)//4 for c in range(4))
    def chunk(name,content): return struct.pack('!I',len(content))+name+content+struct.pack('!I',zlib.crc32(name+content)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(data))+chunk(b'IEND',b'')

(root/'icon.png').write_bytes(png(512))
sizes=[16,32,48,64,128,256]
images=[png(s) for s in sizes]
offset=6+16*len(sizes)
entries=[]
for size,image in zip(sizes,images):
    entries.append(struct.pack('<4B2H2I',size%256,size%256,0,0,1,32,len(image),offset));offset+=len(image)
(root/'icon.ico').write_bytes(struct.pack('<3H',0,1,len(sizes))+b''.join(entries)+b''.join(images))
