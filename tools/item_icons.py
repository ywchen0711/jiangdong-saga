# Packs the Ninja Adventure item pictures (CC0, Pixel-boy and AAA) that the treasures use into one sheet:
# assets/items/icons.png with icons.json ({name: [x, y, w, h]}). Each picture is cut to its first frame.
#   python -I item_icons.py "<Ninja Adventure - Asset Pack>/Items" OUTDIR
import json, os, sys
from PIL import Image
SRC, OUT = sys.argv[1], sys.argv[2]
PICK = {
    'Sword': 'Weapons/Sword/Sprite.png', 'Sword2': 'Weapons/Sword2/Sprite.png', 'Katana': 'Weapons/Katana/Sprite.png', 'BigSword': 'Weapons/BigSword/Sprite.png',
    'Rapier': 'Weapons/Rapier/Sprite.png', 'Sai': 'Weapons/Sai/Sprite.png', 'Ninjaku': 'Weapons/Ninjaku/Sprite.png', 'Lance': 'Weapons/Lance/Sprite.png',
    'Lance2': 'Weapons/Lance2/Sprite.png', 'Fork': 'Weapons/Fork/Sprite.png', 'Axe': 'Weapons/Axe/Sprite.png', 'Club': 'Weapons/Club/Sprite.png',
    'Hammer': 'Weapons/Hammer/Sprite.png', 'Bow': 'Weapons/Bow/Sprite.png', 'Bow2': 'Weapons/Bow2/Sprite.png', 'Stick': 'Weapons/Stick/Sprite.png',
    'MagicWand': 'Weapons/MagicWand/Sprite.png', 'Whip': 'Weapons/Whip/Sprite.png', 'Bone': 'Weapons/Bone/Sprite.png',
    'Scroll': 'Scroll/Scroll.png', 'ScrollEmpty': 'Scroll/ScrollEmpty.png', 'ScrollFire': 'Scroll/ScrollFire.png', 'ScrollIce': 'Scroll/ScrollIce.png',
    'ScrollPlant': 'Scroll/ScrollPlant.png', 'ScrollRock': 'Scroll/ScrollRock.png', 'ScrollThunder': 'Scroll/ScrollThunder.png',
    'Book': 'Object/Book.png', 'Bag': 'Object/Bag.png', 'Gourd': 'Object/Gourd.png', 'Hourglass': 'Object/Hourglass.png', 'MoneyBag': 'Object/MoneyBag.png',
    'PanFlute': 'Object/PanFlute.png', 'Dice': 'Object/Dice 6.png', 'CrateEmpty': 'Object/CrateEmpty.png',
    'Letter': 'Other/Letter.png', 'Letter2': 'Other/Letter2.png', 'Letter3': 'Other/Letter3.png', 'Stamp': 'Other/Stamp.png',
    'GoldCup': 'Treasure/GoldCup.png', 'SilverCup': 'Treasure/SilverCup.png', 'GoldKey': 'Treasure/GoldKey.png', 'SilverKey': 'Treasure/SilverKey.png',
    'GoldCoin': 'Treasure/GoldCoin.png', 'SilverCoin': 'Treasure/SilverCoin.png', 'Coin': 'Treasure/Coin2.png',
    'GemGreen': 'Resource/GemGreen.png', 'GemPurple': 'Resource/GemPurple.png', 'GemRed': 'Resource/GemRed.png', 'GemYellow': 'Resource/GemYellow.png',
    'BarIron': 'Resource/BarIron.png', 'BarGold': 'Resource/BarGold.png', 'BarSilver': 'Resource/BarSilver.png', 'Feather': 'Resource/feather.png', 'Rock': 'Resource/Rock.png',
    'Nut': 'Food/Nut.png', 'Fish': 'Food/Fish.png', 'Meat': 'Food/Meat.png', 'TeaLeaf': 'Food/TeaLeaf.png', 'Onigiri': 'Food/Onigiri.png',
    'LifePot': 'Potion/LifePot.png', 'Medipack': 'Potion/Medipack.png', 'WaterPot': 'Potion/WaterPot.png', 'MilkPot': 'Potion/MilkPot.png', 'Heart': 'Potion/Heart.png',
    'Bomb': 'Projectile/Bomb.png', 'Dynamite': 'Projectile/Dynamite.png', 'Kunai': 'Projectile/Kunai.png',
}
ims = {}
for k, rel in PICK.items():
    p = os.path.join(SRC, rel)
    if not os.path.exists(p): print('missing', rel); continue
    im = Image.open(p).convert('RGBA')
    if im.width > 16 and im.height <= 16: im = im.crop((0, 0, im.height, im.height))  # strips: first frame
    bb = im.getbbox()
    if bb: im = im.crop(bb)
    ims[k] = im
x, y, rowh, W = 0, 0, 0, 256
meta = {}
for k, im in ims.items():
    if x + im.width > W: x, y, rowh = 0, y + rowh + 1, 0
    meta[k] = [x, y, im.width, im.height]; x += im.width + 1; rowh = max(rowh, im.height)
sheet = Image.new('RGBA', (W, y + rowh))
for k, im in ims.items(): sheet.alpha_composite(im, tuple(meta[k][:2]))
os.makedirs(OUT, exist_ok=True)
sheet.save(os.path.join(OUT, 'icons.png'), optimize=True)
json.dump(meta, open(os.path.join(OUT, 'icons.json'), 'w'), separators=(',', ':'))
print(len(meta), sheet.size)
