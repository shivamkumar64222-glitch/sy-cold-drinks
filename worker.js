const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Setup-Token",
  "Access-Control-Max-Age": "86400"
};
const json = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers: {...CORS,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
});
const fail = (message,status=400) => json({success:false,message},status);
const now = () => Math.floor(Date.now()/1000);
const enc = new TextEncoder();
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((s.length+3)%4)),c=>c.charCodeAt(0));
async function derive(password,salt){
 const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
 return b64u(await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:210000,hash:"SHA-256"},key,256));
}
async function sign(value,secret){
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return b64u(await crypto.subtle.sign("HMAC",key,enc.encode(value)));
}
async function makeToken(admin,secret){
 const payload=b64u(enc.encode(JSON.stringify({sub:admin.id,email:admin.email,exp:now()+86400})));
 return payload+"."+await sign(payload,secret);
}
async function verifyToken(request,env){
 const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 const [payload,signature]=token.split(".");
 if(!payload||!signature||!env.SESSION_SECRET)return null;
 if(await sign(payload,env.SESSION_SECRET)!==signature)return null;
 try{const data=JSON.parse(new TextDecoder().decode(unb64u(payload)));if(data.exp<now())return null;
 const admin=await env.DB.prepare("SELECT id,email,is_active FROM admin_users WHERE id=?").bind(data.sub).first();
 return admin&&admin.is_active?admin:null;}catch{return null;}
}
const safeProduct = p => ({
 id:p.id,category_id:p.category_id,name:p.name,slug:p.slug,brand:p.brand,
 description:p.description,size_label:p.size_label,mrp:p.mrp,selling_price:p.selling_price,
 stock_quantity:p.stock_quantity,image_url:p.image_url,is_chilled:p.is_chilled,is_available:p.is_available
});
function slugify(s){return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||"product";}
async function body(request){try{return await request.json();}catch{return null;}}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(method==="OPTIONS")return new Response(null,{headers:CORS});
  try{
   if(path==="/api/health"&&method==="GET"){
    const r=await env.DB.prepare("SELECT COUNT(*) AS count FROM products").first();
    return json({success:true,database:"Connected",products:r.count});
   }
   if(path==="/api/store"&&method==="GET"){
    const rows=await env.DB.prepare("SELECT setting_key,setting_value FROM store_settings").all();
    const store=Object.fromEntries((rows.results||[]).map(x=>[x.setting_key,x.setting_value]));
    return json({success:true,store});
   }
   if(path==="/api/categories"&&method==="GET"){
    const r=await env.DB.prepare("SELECT id,name,slug,description,sort_order FROM categories WHERE is_active=1 ORDER BY sort_order,name").all();
    return json({success:true,categories:r.results||[]});
   }
   if(path==="/api/products"&&method==="GET"){
    const r=await env.DB.prepare("SELECT * FROM products WHERE is_available=1 AND stock_quantity>0 ORDER BY name").all();
    return json({success:true,products:(r.results||[]).map(safeProduct)});
   }
   if(path==="/api/admin/setup"&&method==="POST"){
    if(!env.ADMIN_SETUP_TOKEN)return fail("Admin setup token is not configured",503);
    const token=request.headers.get("X-Admin-Setup-Token")||"";
    if(token.length<24||token!==env.ADMIN_SETUP_TOKEN)return fail("Invalid setup token",401);
    const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_users").first();
    if(count.n>0)return fail("Admin account already initialized",409);
    const b=await body(request);
    if(!b||typeof b.email!=="string"||!/^\S+@\S+\.\S+$/.test(b.email)||typeof b.password!=="string"||b.password.length<12)return fail("Valid email and password (at least 12 characters) are required");
    const salt=crypto.getRandomValues(new Uint8Array(16)),hash=await derive(b.password,salt);
    const passwordHash="pbkdf2$210000$"+b64u(salt)+"$"+hash;
    const result=await env.DB.prepare("INSERT INTO admin_users(email,password_hash,is_active) VALUES(?,?,1)").bind(b.email.toLowerCase(),passwordHash).run();
    return json({success:true,message:"Admin account created. Remove ADMIN_SETUP_TOKEN secret after setup.",admin_id:result.meta.last_row_id},201);
   }
   if(path==="/api/admin/login"&&method==="POST"){
    const b=await body(request);if(!b||typeof b.email!=="string"||typeof b.password!=="string")return fail("Email and password required");
    const admin=await env.DB.prepare("SELECT * FROM admin_users WHERE email=? AND is_active=1").bind(b.email.toLowerCase()).first();
    if(!admin)return fail("Invalid email or password",401);
    const parts=String(admin.password_hash).split("$");
    if(parts.length!==4||parts[0]!=="pbkdf2")return fail("Admin password format invalid; reset setup required",401);
    const actual=await derive(b.password,unb64u(parts[2]));
    if(actual!==parts[3])return fail("Invalid email or password",401);
    return json({success:true,token:await makeToken(admin,env.SESSION_SECRET),admin:{id:admin.id,email:admin.email}});
   }
   if(path.startsWith("/api/admin/")){
    const admin=await verifyToken(request,env);if(!admin)return fail("Unauthorized",401);
    if(path==="/api/admin/me"&&method==="GET")return json({success:true,admin:{id:admin.id,email:admin.email}});
    if(path==="/api/admin/logout"&&method==="POST")return json({success:true});
    if(path==="/api/admin/products"&&method==="GET"){
     const r=await env.DB.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
     return json({success:true,products:(r.results||[]).map(safeProduct)});
    }
    if(path==="/api/admin/products"&&method==="POST"){
     const b=await body(request);if(!b||typeof b.name!=="string"||!b.name.trim())return fail("Product name required");
     const mrp=Number(b.mrp),price=Number(b.selling_price),stock=Number(b.stock_quantity);
     if(![mrp,price,stock].every(Number.isSafeInteger)||mrp<0||price<0||price>mrp||stock<0)return fail("Invalid price or stock");
     if(b.category_id!=null&&!Number.isSafeInteger(Number(b.category_id)))return fail("Invalid category");
     const slug=slugify(b.slug||b.name)+"-"+crypto.randomUUID().slice(0,6);
     const r=await env.DB.prepare("INSERT INTO products(category_id,name,slug,brand,description,size_label,mrp,selling_price,stock_quantity,image_url,is_chilled,is_available) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)")
      .bind(b.category_id?Number(b.category_id):null,b.name.trim(),slug,b.brand||null,b.description||null,b.size_label||null,mrp,price,stock,b.image_url||null,b.is_chilled?1:0).run();
     return json({success:true,id:r.meta.last_row_id,message:"Product added"},201);
    }
    const productMatch=path.match(/^\/api\/admin\/products\/(\d+)$/);
    if(productMatch&&method==="PATCH"){
     const id=Number(productMatch[1]),b=await body(request);if(!b||typeof b!=="object")return fail("Invalid product data");
     const allowed=["category_id","name","brand","description","size_label","mrp","selling_price","stock_quantity","image_url","is_chilled","is_available"];
     const fields=[],values=[];
     for(const key of allowed)if(Object.hasOwn(b,key)){
      let v=b[key];
      if(["mrp","selling_price","stock_quantity","category_id"].includes(key)&&v!==null){v=Number(v);if(!Number.isSafeInteger(v)||v<0)return fail("Invalid "+key);}
      if(key==="name"&&(!String(v).trim()||String(v).length>160))return fail("Invalid product name");
      if(["is_chilled","is_available"].includes(key)){if(![true,false,0,1].includes(v))return fail("Invalid "+key);v=v?1:0;}
      if(["brand","description","size_label","image_url","category_id"].includes(key)&&v==="")v=null;
      fields.push(key+"=?");values.push(v);
     }
     if(!fields.length)return fail("No fields to update");
     const current=await env.DB.prepare("SELECT mrp,selling_price FROM products WHERE id=?").bind(id).first();if(!current)return fail("Product not found",404);
     const nextMrp=b.mrp===undefined?current.mrp:Number(b.mrp),nextPrice=b.selling_price===undefined?current.selling_price:Number(b.selling_price);
     if(nextPrice>nextMrp)return fail("Selling price cannot exceed MRP");
     values.push(id);await env.DB.prepare("UPDATE products SET "+fields.join(",")+",updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(...values).run();
     return json({success:true,message:"Product updated"});
    }
    if(productMatch&&method==="DELETE"){
     const id=Number(productMatch[1]);
     const used=await env.DB.prepare("SELECT COUNT(*) AS n FROM order_items WHERE product_id=?").bind(id).first();
     if(used.n>0){await env.DB.prepare("UPDATE products SET is_available=0,stock_quantity=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();}
     else await env.DB.prepare("DELETE FROM products WHERE id=?").bind(id).run();
     return json({success:true,message:"Product removed"});
    }
    return fail("Admin route not found",404);
   }
   if(path==="/api/orders"&&method==="POST"){
    const b=await body(request);
    if(!b||typeof b.customer_name!=="string"&&typeof b.name!=="string")return fail("Customer name required");
    const name=String(b.customer_name||b.name).trim(),phone=String(b.customer_phone||b.phone||"").trim();
    if(!name||!/^[6-9]\d{9}$/.test(phone))return fail("Valid name and 10-digit phone required");
    const type=b.order_type==="pickup"?"pickup":"delivery";
    const address=String(b.address||"").trim();
    const items=Array.isArray(b.items)?b.items:[];
    if(!items.length||items.length>30)return fail("Cart is empty or too large");
    const settingsRows=await env.DB.prepare("SELECT setting_key,setting_value FROM store_settings").all();
    const settings=Object.fromEntries((settingsRows.results||[]).map(x=>[x.setting_key,x.setting_value]));
    const min=Number(settings.minimum_order??100),fee=type==="pickup"?0:Number(settings.delivery_charge??20);
    let subtotal=0,validated=[];
    for(const item of items){
     const id=Number(item.product_id),qty=Number(item.quantity);
     if(!Number.isSafeInteger(id)||!Number.isSafeInteger(qty)||qty<1||qty>50)return fail("Invalid cart item");
     const p=await env.DB.prepare("SELECT id,name,size_label,selling_price,stock_quantity,is_available FROM products WHERE id=?").bind(id).first();
     if(!p||!p.is_available||p.stock_quantity<qty)return fail("Stock unavailable for "+(p?.name||"a product"),409);
     subtotal+=p.selling_price*qty;if(!Number.isSafeInteger(subtotal))return fail("Order total too large");
     validated.push({...p,qty,line:p.selling_price*qty});
    }
    if(type==="delivery"&&subtotal<min)return fail("Minimum home delivery order is ₹"+min);
    if(type==="delivery"&&!address)return fail("Delivery address required");
    const total=subtotal+fee,orderNumber="SY"+Date.now().toString().slice(-9);
    let customer=await env.DB.prepare("SELECT id FROM customers WHERE phone=? ORDER BY id LIMIT 1").bind(phone).first();
    if(customer) await env.DB.prepare("UPDATE customers SET name=? WHERE id=?").bind(name,customer.id).run();
    else {
     const created=await env.DB.prepare("INSERT INTO customers(name,phone) VALUES(?,?)").bind(name,phone).run();
     customer={id:created.meta.last_row_id};
    }
    const result=await env.DB.prepare("INSERT INTO orders(order_number,customer_id,customer_name,customer_phone,order_type,payment_method,status,subtotal,delivery_fee,total_amount,address,landmark,notes) VALUES(?,?,?,?,?,'cod','pending',?,?,?,?,?,?)")
      .bind(orderNumber,customer.id,name,phone,type,subtotal,fee,total,address||null,b.landmark||null,b.notes||null).run();
    const orderId=result.meta.last_row_id;
    for(const p of validated){
     const stock=await env.DB.prepare("UPDATE products SET stock_quantity=stock_quantity-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock_quantity>=?").bind(p.qty,p.id,p.qty).run();
     if(stock.meta.changes!==1)return fail("Stock changed while placing order. Please retry.",409);
     await env.DB.prepare("INSERT INTO order_items(order_id,product_id,product_name,size_label,unit_price,quantity,line_total) VALUES(?,?,?,?,?,?,?)").bind(orderId,p.id,p.name,p.size_label,p.selling_price,p.qty,p.line).run();
    }
    return json({success:true,order_number:orderNumber,total_amount:total,message:"Order received"},201);
   }
   return fail("API route not found",404);
  }catch(error){console.error("Worker error",error);return fail("Internal server error",500);}
 }
};