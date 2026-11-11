// Jumo PWA - Supabase client configuration
const SUPABASE_URL = "https://talcplmfoxzbiednomjp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_y7FNmcu8-LPPM1k-Dz9q6w_IBG2EN84";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (id) => document.getElementById(id);
let currentUser = null;
let currentSection = "inventory";

const sections = {
  inventory: {title:"المخزون", eyebrow:"STOCK", table:"inventory_items", fields:["name","category","quantity","unit","unit_cost"], headers:["الاسم","النوع","الكمية","الوحدة","تكلفة الوحدة"]},
  production: {title:"الإنتاج", eyebrow:"PRODUCTION", table:"production_records", fields:["product_name","quantity","worker_name","work_date"], headers:["المنتج","الكمية","العامل","التاريخ"]},
  sales: {title:"المبيعات", eyebrow:"SALES", table:"sales", fields:["product_name","quantity","unit_price","sale_date"], headers:["المنتج","الكمية","سعر الوحدة","التاريخ"]},
  expenses: {title:"المصاريف", eyebrow:"EXPENSES", table:"expenses", fields:["description","amount","category","expense_date"], headers:["الوصف","المبلغ","النوع","التاريخ"]},
  payroll: {title:"الأجور", eyebrow:"PAYROLL", table:"payroll", fields:["employee_name","month","salary_amount","paid_amount"], headers:["العامل","الشهر","الأجر","المدفوع"]}
};

function showMessage(message, isError=true) {
  $("appMessage").textContent = message;
  $("appMessage").style.color = isError ? "#a34c36" : "#397454";
}
function setLoggedIn(user, profile) {
  currentUser = user;
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  $("userLabel").textContent = profile?.full_name || user.email || "";
  loadSection();
}
async function checkSession() {
  const {data:{session}} = await db.auth.getSession();
  if (!session) return;
  const {data:profile,error} = await db.from("profiles").select("full_name,role,active").eq("id",session.user.id).single();
  if (error || !profile || !profile.active) {
    await db.auth.signOut();
    $("loginMessage").textContent = "الحساب غير مربوط بملف نشط في Jumo. راجع المسؤول.";
    return;
  }
  setLoggedIn(session.user, profile);
}
$("loginForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  $("loginMessage").textContent = "جاري تسجيل الدخول...";
  const {data,error} = await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  if (error) {$("loginMessage").textContent = "تعذر الدخول: " + error.message; return;}
  const {data:profile,error:profileError} = await db.from("profiles").select("full_name,role,active").eq("id",data.user.id).single();
  if (profileError || !profile || !profile.active) {
    await db.auth.signOut();
    $("loginMessage").textContent = "تم الدخول لكن الحساب غير مربوط بملف Jumo. تواصل مع المسؤول.";
    return;
  }
  $("loginMessage").textContent = "";
  setLoggedIn(data.user,profile);
});
$("logoutBtn").addEventListener("click", async()=>{await db.auth.signOut();location.reload();});
$("refreshBtn").addEventListener("click",loadSection);
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
  currentSection=btn.dataset.section;
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===btn));
  $("sectionTitle").textContent=sections[currentSection].title;
  $("sectionEyebrow").textContent=sections[currentSection].eyebrow;
  $("inventoryTools").classList.toggle("hidden",currentSection!=="inventory");
  loadSection();
}));

async function loadSection(){
  if(!currentUser)return;
  const config=sections[currentSection];
  $("sectionTitle").textContent=config.title;
  $("sectionEyebrow").textContent=config.eyebrow;
  $("inventoryTools").classList.toggle("hidden",currentSection!=="inventory");
  $("tableHead").innerHTML="<tr>"+config.headers.map(h=>`<th>${h}</th>`).join("")+"</tr>";
  $("tableBody").innerHTML='<tr><td class="empty" colspan="8">جاري التحميل...</td></tr>';
  const {data,error}=await db.from(config.table).select(config.fields.join(",")).order("created_at",{ascending:false}).limit(100);
  if(error){$("tableBody").innerHTML=`<tr><td class="empty" colspan="8">تعذر تحميل البيانات: ${escapeHtml(error.message)}</td></tr>`;return;}
  if(!data?.length){$("tableBody").innerHTML='<tr><td class="empty" colspan="8">لا توجد بيانات حالياً</td></tr>';return;}
  $("tableBody").innerHTML=data.map(row=>"<tr>"+config.fields.map(field=>`<td>${escapeHtml(row[field]??"—")}</td>`).join("")+"</tr>").join("");
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

$("inventoryForm").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const button=e.submitter;button.disabled=true;showMessage("");
  const payload={
    workshop_id: await getWorkshopId(),
    name:$("itemName").value.trim(),
    category:$("itemCategory").value,
    quantity:Number($("itemQty").value),
    unit:$("itemUnit").value.trim(),
    unit_cost:Number($("itemCost").value||0),
    created_by:currentUser.id
  };
  if(!payload.workshop_id){showMessage("لم يتم العثور على ورشة مرتبطة بالحساب.");button.disabled=false;return;}
  const {error}=await db.from("inventory_items").insert(payload);
  button.disabled=false;
  if(error){showMessage("تعذرت الإضافة: "+error.message);return;}
  $("inventoryForm").reset();$("itemUnit").value="متر";$("itemCost").value="0";
  showMessage("تمت إضافة المادة إلى المخزون بنجاح.",false);loadSection();
});
async function getWorkshopId(){
  const {data,error}=await db.from("profiles").select("workshop_id").eq("id",currentUser.id).single();
  return error?null:data.workshop_id;
}
$("langBtn").addEventListener("click",()=>{alert("واجهة الفرنسية قيد الإضافة في النسخة القادمة.");});
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}
checkSession();
