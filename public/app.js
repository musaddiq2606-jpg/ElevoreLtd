const $ = (s) => document.querySelector(s);
const state = { products: [], categories: [], category: 'All', search: '', cart: JSON.parse(localStorage.getItem('elevore-cart') || '[]') };
const money = n => n == null ? 'Price on request' : new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n);
const slug = s => s.toLowerCase().replace(/&/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function artClass(category){
  if(category==='Mugs') return 'mug';
  if(category==='Vases') return 'vase';
  if(category==='Oil Burners') return 'burner';
  if(category==='Trinket Dishes' || category==='Wall Decor') return 'round';
  if(category==='Decor') return 'tall';
  return '';
}
function renderProducts(){
  const q=state.search.toLowerCase();
  const visible=state.products.filter(p=>(state.category==='All'||p.category===state.category)&&(!q||p.name.toLowerCase().includes(q)||(p.sku||'').toLowerCase().includes(q)));
  $('#productGrid').innerHTML=visible.map(p=>`<article class="product-card"><div class="product-art ${slug(p.category)} ${p.imageUrl?'has-image':''}">${p.imageUrl?`<img class="product-image" src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}<div class="art-object ${artClass(p.category)}"></div></div><div class="product-info"><div class="product-meta"><span>${p.category}</span><span>${p.sku||'Coming soon'}</span></div><h3>${escapeHtml(p.name)}</h3><div class="product-bottom"><span class="price">${money(p.retailPrice)}</span><button class="add" data-id="${p.id}" ${!p.available?'disabled':''} aria-label="Add ${escapeHtml(p.name)} to cart">+</button></div></div></article>`).join('');
  $('#emptyState').hidden=visible.length>0;
  document.querySelectorAll('.product-image').forEach(img=>img.addEventListener('error',()=>img.closest('.product-art')?.classList.add('image-failed'),{once:true}));
  document.querySelectorAll('.add').forEach(b=>b.addEventListener('click',()=>addToCart(Number(b.dataset.id))));
}
function renderFilters(){
  const cats=['All',...state.categories.map(x=>x.category)];
  $('#filters').innerHTML=cats.map(c=>`<button class="filter ${c===state.category?'active':''}" data-category="${c}">${c}</button>`).join('');
  document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.category;renderFilters();renderProducts()}));
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function saveCart(){localStorage.setItem('elevore-cart',JSON.stringify(state.cart));renderCart()}
function addToCart(id){const p=state.products.find(x=>x.id===id);if(!p||!p.available)return;const x=state.cart.find(i=>i.id===id);if(x)x.qty++;else state.cart.push({id,qty:1});saveCart();openCart()}
function changeQty(id,d){const x=state.cart.find(i=>i.id===id);if(!x)return;x.qty+=d;if(x.qty<=0)state.cart=state.cart.filter(i=>i.id!==id);saveCart()}
function renderCart(){
  const rows=state.cart.map(i=>({item:i,p:state.products.find(p=>p.id===i.id)})).filter(x=>x.p);
  $('#cartItems').innerHTML=rows.length?rows.map(({item,p})=>`<div class="cart-row"><div><h4>${escapeHtml(p.name)}</h4><small>${money(p.retailPrice)} × ${item.qty}</small></div><div class="cart-controls"><button data-action="minus" data-id="${p.id}">−</button><span>${item.qty}</span><button data-action="plus" data-id="${p.id}">+</button><button class="remove" data-action="remove" data-id="${p.id}">×</button></div></div>`).join(''):'<p style="color:rgba(23,23,19,.55);padding:20px 0">Your cart is empty.</p>';
  const count=rows.reduce((a,x)=>a+x.item.qty,0);const total=rows.reduce((a,x)=>a+(x.p.retailPrice||0)*x.item.qty,0);$('#cartCount').textContent=count;$('#cartTotal').textContent=money(total);$('#checkoutButton').disabled=!rows.length;
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{const id=Number(b.dataset.id);if(b.dataset.action==='plus')changeQty(id,1);if(b.dataset.action==='minus')changeQty(id,-1);if(b.dataset.action==='remove'){state.cart=state.cart.filter(i=>i.id!==id);saveCart()}}));
}
function openCart(){ $('#cartDrawer').classList.add('open');$('#cartDrawer').setAttribute('aria-hidden','false');$('#overlay').hidden=false }
function closeCart(){ $('#cartDrawer').classList.remove('open');$('#cartDrawer').setAttribute('aria-hidden','true');$('#overlay').hidden=true }

async function init(){
  try{const [p,c]=await Promise.all([fetch('/api/products').then(r=>r.json()),fetch('/api/categories').then(r=>r.json())]);state.products=p;state.categories=c;$('#productStat').textContent=p.length;renderFilters();renderProducts();renderCart()}catch{ $('#productGrid').innerHTML='<p>Unable to load products. Please refresh.</p>' }
}
$('#searchInput').addEventListener('input',e=>{state.search=e.target.value;renderProducts()});$('#cartButton').addEventListener('click',openCart);$('#closeCart').addEventListener('click',closeCart);$('#overlay').addEventListener('click',closeCart);$('#checkoutButton').addEventListener('click',()=>{closeCart();$('#checkoutDialog').showModal()});
$('#contactForm').addEventListener('submit',async e=>{e.preventDefault();const status=$('#contactStatus');status.textContent='Sending…';status.className='form-status';const b=Object.fromEntries(new FormData(e.target));try{const r=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});if(!r.ok)throw new Error();status.textContent='Message received. Thank you.';status.classList.add('ok');e.target.reset()}catch{status.textContent='Could not send your message.';status.classList.add('error')}});
$('#checkoutForm').addEventListener('submit',async e=>{e.preventDefault();const status=$('#checkoutStatus');status.textContent='Submitting…';status.className='form-status dark-status';const b=Object.fromEntries(new FormData(e.target));b.items=state.cart;try{const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const out=await r.json();if(!r.ok)throw new Error(out.error||'Order failed');status.textContent=`Order enquiry #${out.orderId} saved — total ${money(out.total)}.`;status.classList.add('ok');state.cart=[];saveCart();e.target.reset();setTimeout(()=>$('#checkoutDialog').close(),1800)}catch(err){status.textContent=err.message;status.classList.add('error')}});
$('#year').textContent=new Date().getFullYear();init();
