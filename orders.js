const API_BASE="https://sy-cold-drink.shivam65838.workers.dev";
const $=id=>document.getElementById(id);
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN");
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statuses={pending:"दुकान की पुष्टि बाकी",confirmed:"ऑर्डर Confirmed",preparing:"तैयार हो रहा है",out_for_delivery:"डिलीवरी के लिए निकल गया",ready_for_pickup:"Pickup के लिए तैयार",completed:"पूरा हो गया",cancelled:"रद्द किया गया"};
function dateText(value){const date=new Date(String(value||"").replace(" ","T")+"Z");return Number.isNaN(date.getTime())?escapeHtml(value):date.toLocaleString("hi-IN",{dateStyle:"medium",timeStyle:"short"});}
function renderOrders(orders){
  $("ordersMessage").classList.add("hidden");
  if(!orders.length){
    $("ordersMessage").classList.remove("hidden");
    $("ordersMessage").innerHTML='इस ब्राउज़र से अभी कोई Order नहीं मिला। अगली बार ऑर्डर करने पर वह यहाँ दिखेगा।<br><a class="primary-btn" href="./#products">Products देखें</a>';
    return;
  }
  $("ordersList").innerHTML=orders.map(order=>{
    const itemRows=(order.items||[]).map(item=>`<li><span><b>${escapeHtml(item.product_name)}</b>${item.size_label?` · ${escapeHtml(item.size_label)}`:""}<small>${money(item.unit_price)} each × ${Number(item.quantity)}</small></span><b>${money(item.line_total)}</b></li>`).join("");
    const orderType=order.order_type==="pickup"?"Shop Pickup":"Home Delivery";
    const delivery=order.order_type==="pickup"?"दुकान से Pickup":order.address||"पता उपलब्ध नहीं";
    return `<article class="order-card"><div class="order-card-head"><div><h2>${escapeHtml(order.order_number)}</h2><div class="order-date">${dateText(order.created_at)}</div></div><span class="order-status">${escapeHtml(statuses[order.status]||order.status||"स्थिति उपलब्ध नहीं")}</span></div><ul class="order-lines">${itemRows||"<li>Product विवरण उपलब्ध नहीं</li>"}</ul><div class="order-breakdown"><div><span>Products का कुल</span><b>${money(order.subtotal)}</b></div>${Number(order.delivery_fee)>0?`<div><span>Delivery charge</span><b>${money(order.delivery_fee)}</b></div>`:""}</div><div class="order-total"><span>कुल भुगतान</span><b>${money(order.total_amount)}</b></div><div class="order-meta"><span>Order Type: <b>${orderType}</b></span><span>${escapeHtml(delivery)}</span>${order.landmark?`<span>Landmark: ${escapeHtml(order.landmark)}</span>`:""}${order.notes?`<span>निर्देश: ${escapeHtml(order.notes)}</span>`:""}</div></article>`;
  }).join("");
}
async function loadOrders(){
  const token=localStorage.getItem("sycd-customer-token")||"";
  if(!/^[a-f0-9]{64}$/i.test(token)){renderOrders([]);return;}
  try{
    const response=await fetch(API_BASE+"/api/customer/orders",{headers:{"X-Customer-Token":token}});
    const data=await response.json().catch(()=>({success:false}));
    if(!response.ok||data.success===false)throw new Error(data.message||"अभी Orders नहीं लोड हो सके।");
    renderOrders(data.orders||[]);
  }catch(error){$("ordersMessage").classList.remove("hidden");$("ordersMessage").classList.add("order-error");$("ordersMessage").textContent="Orders अभी नहीं दिख पा रहे। इंटरनेट कनेक्शन जाँचकर Refresh करें।";console.error(error);}
}
loadOrders();

