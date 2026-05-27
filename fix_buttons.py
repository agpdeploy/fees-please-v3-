import os
import re

standard_class = "py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"

def replace_button_class(m):
    pre = m.group(1)
    cls = m.group(2)
    
    prefix = "w-full "
    if "flex-1" in cls: prefix = "flex-1 "
    elif "flex-[2]" in cls: prefix = "flex-[2] "
    elif "px-" in cls: prefix = "px-6 "
    
    suffix = ""
    if "mt-2" in cls: suffix = " mt-2"
    if "mt-4" in cls: suffix = " mt-4"
    if "group" in cls: suffix += " group"
    
    new_cls = prefix + standard_class + suffix
    return pre + "className=\"" + new_cls + "\""

for root, dirs, files in os.walk("components"):
    for file in files:
        if not file.endswith(".tsx"): continue
        path = os.path.join(root, file)
        
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Matches <button ... className="...bg-emerald-600..."
        new_content = re.sub(r'(<button[^>]*?)className=\"([^\"]*bg-emerald-600[^\"]*)\"', replace_button_class, content)
        
        # Matches <button ... className={`...bg-emerald-600...`} if there are no dynamic vars inside it
        # I won't touch template strings for now, only double quotes.
        
        if content != new_content:
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Updated {path}")
