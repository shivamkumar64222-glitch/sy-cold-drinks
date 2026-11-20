const API_BASE = "https://sy-cold-drink.shivam65838.workers.dev";
const rupees = n => "₹" + Number(n || 0).toLocaleString("en-IN");
let products = [], categories = [], activeCategory = "all";
let cart = JSON.parse(localStorage.getItem("sycd-cart") || "[]");
const $ = id => document.getElementById(id);
const saveCart = () => { localStorage.setItem("sycd-cart", JSON.stringify(cart)); renderCart(); };
async function api(path, options={}) {
  const response = await fetch(API_BASE + path, { ...options, headers: { "Content-Type":"application/json", ...(options.headers||{}) } });
  const data = await response.json().catch(()=>({success:false,message:"Invalid API response"}));
  if (!response.ok || data.success === false) throw new Error(data.message || "Request failed");
  return data;
}
function renderProducts() {
  const query = ($("searchInput").value || "").trim().toLowerCase();
  const filtered = products.filter(p => (activeCategory==="all" || String(p.category_id)===activeCategory) && [p.name,p.brand,p.description].join(" ").toLowerCase().includes(query));
  $("productGrid").innerHTML = filtered.length ? filtered.map(p => `
    <article class="product-card">
      <div class="product-image">${p.image_url ? `<img src="${escapeAttr(p.image_url)}" alt="${escapeAttr(p.name)}" loading="lazy" onerror="this.style.display='none'">` : '<span class="product-placeholder">🥤</span>'}</div>
      <div class="product-info"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.size_label || p.brand || "Chilled Refreshment")}</p>
      <div class="price-line"><b>${rupees(p.selling_price)}</b>${Number(p.mrp)>Number(p.selling_price)?`<del>${rupees(p.mrp)}</del>`:""}</div>
      <button class="add-btn" data-add="${p.id}" ${Number(p.stock_quantity)<=0?"disabled":""}>${Number(p.stock_quantity)<=0?"Out of stock":"＋ Cart में जोड़ें"}</button></div>
    </article>`).join("") : '<div class="empty-products">अभी Products उपलब्ध नहीं हैं। जल्द ही नई सूची आएगी।</div>';
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function escapeAttr(v){return escapeHtml(v);}
function renderCategories(){
  $("categories").innerHTML = '<button class="category active" data-category="all">सभी</button>' + categories.map(c=>`<button class="category" data-category="${c.id}">${escapeHtml(c.name)}</button>`).join("");
}
function addToCart(id){
  const p=products.find(x=>Number(x.id)===Number(id)); if(!p)return;
  const line=cart.find(x=>Number(x.id)===Number(id));
  if(line){if(line.qty>=Number(p.stock_quantity))return alert("इतना Stock उपलब्ध नहीं है।");line.qty++;}
  else cart.push({id:p.id,name:p.name,price:Number(p.selling_price),size:p.size_label||"",qty:1});
  saveCart();
  toggleCart(true);
}
function renderCart(){
  const count=cart.reduce((s,x)=>s+x.qty,0), subtotal=cart.reduce((s,x)=>s+x.price*x.qty,0);
  $("cartCount").textContent=count; $("cartSubtotal").textContent=rupees(subtotal);
  const type=$("orderType")?.value||"delivery", fee=type==="pickup"?0:(subtotal?20:0);
  $("cartDelivery").textContent=type==="pickup"?"Free":rupees(fee); $("cartTotal").textContent=rupees(subtotal+fee);
  $("cartItems").innerHTML=cart.length?cart.map(x=>`<div class="cart-item"><div><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.size)} · ${rupees(x.price)} each</small></div><div class="qty-control"><button data-qty="${x.id}" data-delta="-1">−</button><b>${x.qty}</b><button data-qty="${x.id}" data-delta="1">＋</button></div></div>`).join(""):'<p class="empty-cart">आपका Cart अभी खाली है।</p>';
}
function toggleCart(open){$("cartDrawer").classList.toggle("open",open);$("drawerBackdrop").classList.toggle("open",open);}
async function loadStore(){
  try{const d=await api("/api/store");const s=d.store||{};if(s.store_name){$("storeName").textContent=s.store_name;document.title=s.store_name+" | Cold Drinks";}if(s.address)$("storeAddress").textContent=s.address;if(s.phone)$("callStore").href="tel:"+s.phone;if(s.phone)$("callStore").textContent="☎ "+s.phone;}
  catch(e){console.warn("Store settings unavailable",e);}
}
async function loadCatalog(){
  try{const [p,c]=await Promise.all([api("/api/products"),api("/api/categories")]);products=p.products||[];categories=c.categories||[];renderCategories();renderProducts();}
  catch(e){$("productGrid").innerHTML='<div class="empty-products">Products अभी लोड नहीं हो पाए। कृपया थोड़ी देर बाद Refresh करें।</div>';console.error(e);}
}
$("productGrid").addEventListener("click",e=>{const b=e.target.closest("[data-add]");if(b)addToCart(b.dataset.add);});
$("categories").addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(!b)return;activeCategory=b.dataset.category;document.querySelectorAll(".category").forEach(x=>x.classList.toggle("active",x===b));renderProducts();});
$("searchInput").addEventListener("input",renderProducts);
$("openCart").onclick=()=>toggleCart(true);$("closeCart").onclick=()=>toggleCart(false);$("drawerBackdrop").onclick=()=>toggleCart(false);
$("cartItems").addEventListener("click",e=>{const b=e.target.closest("[data-qty]");if(!b)return;const x=cart.find(i=>String(i.id)===b.dataset.qty);if(!x)return;x.qty+=Number(b.dataset.delta);if(x.qty<=0)cart=cart.filter(i=>i!==x);saveCart();});
$("checkoutBtn").onclick=()=>{
  if(!cart.length)return alert("पहले Cart में Product जोड़ें।");
  const subtotal=cart.reduce((s,x)=>s+x.price*x.qty,0);
  if($("orderType").value==="delivery" && subtotal<100)return alert("Home Delivery के लिए न्यूनतम ऑर्डर ₹100 है। Pickup चुन सकते हैं।");
  toggleCart(false);$("checkoutDialog").showModal();
};
$("closeCheckout").onclick=()=>$("checkoutDialog").close();
$("orderType").onchange=()=>{$("addressField").classList.toggle("hidden",$("orderType").value==="pickup");renderCart();};
$("checkoutForm").onsubmit=async e=>{
  e.preventDefault();const message=$("checkoutMessage");message.textContent="ऑर्डर भेजा जा रहा है…";
  const fd=new FormData(e.currentTarget), payload=Object.fromEntries(fd.entries());
  payload.items=cart.map(x=>({product_id:x.id,quantity:x.qty}));payload.payment_method="cod";
  try{
    const requestToken=crypto.randomUUID();
    const result=await api("/api/orders",{method:"POST",headers:{"Idempotency-Key":requestToken},body:JSON.stringify(payload)});
    message.textContent="ऑर्डर सफल! Order No: "+(result.order_number||result.order?.order_number||"Confirmed");
    cart=[];saveCart();e.currentTarget.reset();
  }catch(err){message.textContent="ऑर्डर अभी ऑनलाइन जमा नहीं हो सका: "+err.message+"। कृपया दुकान पर फोन करें।";console.error(err);}
};
$("year").textContent=new Date().getFullYear();
renderCart();loadStore();loadCatalog();

