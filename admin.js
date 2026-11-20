const API_BASE="https://sy-cold-drink.shivam65838.workers.dev";
const $=id=>document.getElementById(id);let token=sessionStorage.getItem("sycd-admin-token")||"",items=[],editingId=null;
async function api(path,options={}){
 const r=await fetch(API_BASE+path,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{}),...(options.headers||{})}});
 const d=await r.json().catch(()=>({success:false,message:"Invalid API response"}));if(!r.ok||d.success===false)throw new Error(d.message||"Request failed");return d;
}
function showDashboard(){ $("loginCard").classList.add("hidden");$("dashboard").classList.remove("hidden");loadProducts();}
function showLogin(){ $("dashboard").classList.add("hidden");$("loginCard").classList.remove("hidden");}
$("showSetup").onclick=()=>{$("setupCard").classList.toggle("hidden");};
$("setupForm").onsubmit=async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);$("setupMessage").textContent="Admin account बनाया जा रहा है…";
 try{const response=await fetch(API_BASE+"/api/admin/setup",{method:"POST",headers:{"Content-Type":"application/json","X-Admin-Setup-Token":f.get("setup_token")},body:JSON.stringify({email:f.get("email"),password:f.get("password")})});const d=await response.json();if(!response.ok||!d.success)throw new Error(d.message||"Setup failed");$("setupMessage").textContent="Admin account बन गया। अब Login करें।";$("setupCard").classList.add("hidden");}
 catch(err){$("setupMessage").textContent=err.message;}
};
$("loginForm").onsubmit=async e=>{e.preventDefault();$("loginMessage").textContent="Logging in…";const f=new FormData(e.currentTarget);try{const d=await api("/api/admin/login",{method:"POST",body:JSON.stringify({email:f.get("email"),password:f.get("password")})});token=d.token;sessionStorage.setItem("sycd-admin-token",token);showDashboard();}catch(err){$("loginMessage").textContent=err.message;}};
async function loadProducts(){try{const d=await api("/api/admin/products");items=d.products||[];renderTable();}catch(e){$("productsTable").textContent=e.message;if(e.message.includes("Unauthorized"))logout();}}
function renderTable(){if(!items.length){$("productsTable").textContent="अभी कोई Product नहीं है। ऊपर से पहला Product जोड़ें।";return;}
 $("productsTable").innerHTML='<table class="admin-table"><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th>Action</th></tr></thead><tbody>'+items.map(p=>`<tr><td><b>${esc(p.name)}</b><br>${esc(p.size_label||"")}</td><td>₹${p.selling_price} <small><del>₹${p.mrp}</del></small></td><td>${p.stock_quantity}</td><td>${Number(p.is_available)?"Available":"Hidden"}</td><td><button data-edit="${p.id}">Edit</button><button class="danger" data-delete="${p.id}">Delete</button></td></tr>`).join("")+'</tbody></table>';
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function resetForm(){editingId=null;$("productForm").reset();$("productFormTitle").textContent="नया Product जोड़ें";$("cancelEdit").classList.add("hidden");}
$("productForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),body=Object.fromEntries(f.entries());for(const k of ["mrp","selling_price","stock_quantity"])body[k]=Number(body[k]);if(body.category_id)body.category_id=Number(body.category_id);else delete body.category_id;for(const k of ["image_url","brand","description","size_label"])if(!body[k])body[k]=null;
 if(body.selling_price>body.mrp){$("productMessage").textContent="Selling Price, MRP से अधिक नहीं हो सकता।";return;}
 try{if(editingId)await api("/api/admin/products/"+editingId,{method:"PATCH",body:JSON.stringify(body)});else await api("/api/admin/products",{method:"POST",body:JSON.stringify(body)});$("productMessage").textContent="Product सेव हो गया।";resetForm();await loadProducts();}catch(err){$("productMessage").textContent=err.message;}
};
$("productsTable").addEventListener("click",async e=>{const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");if(edit){const p=items.find(x=>Number(x.id)===Number(edit.dataset.edit));if(!p)return;editingId=p.id;$("productFormTitle").textContent="Product Edit करें";$("cancelEdit").classList.remove("hidden");for(const [k,v] of Object.entries(p)){const input=$("productForm").elements.namedItem(k);if(input)input.value=v??"";}window.scrollTo({top:0,behavior:"smooth"});}
 if(del&&confirm("क्या इस Product को हटाना चाहते हैं?")){try{await api("/api/admin/products/"+del.dataset.delete,{method:"DELETE"});await loadProducts();}catch(err){alert(err.message);}}
});
$("cancelEdit").onclick=resetForm;$("refreshBtn").onclick=loadProducts;
async function logout(){if(token){try{await api("/api/admin/logout",{method:"POST"});}catch(e){}}token="";sessionStorage.removeItem("sycd-admin-token");showLogin();}
$("logoutBtn").onclick=logout;
if(token){api("/api/admin/me").then(showDashboard).catch(logout);}else showLogin();