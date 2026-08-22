import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// --- Icons ชุดใหม่สำหรับหน้านี้ ---
const Icons = {
  ArrowLeft: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  Cash: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path></svg>,
  QrCode: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
  CreditCard: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>,
  Delete: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><line x1="18" y1="9" x2="12" y2="15"></line><line x1="12" y1="9" x2="18" y2="15"></line></svg>,
  CheckCircle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
};

export default function CashierPaymentPage() {
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'promptpay' | 'card'>('cash');
  const [receivedAmount, setReceivedAmount] = useState<string>('3000'); // ค่าจำลองเริ่มต้น

  // ตัวเลขยอดบิลจำลอง
  const totalAmount = 2410.71;
  const change = parseFloat(receivedAmount || '0') - totalAmount;

  // ฟังก์ชันกดเครื่องคิดเลข
  const handleNumpad = (val: string) => {
    if (val === 'clear') {
      setReceivedAmount('');
    } else if (val === 'delete') {
      setReceivedAmount(prev => prev.slice(0, -1));
    } else if (val === 'exact') {
      setReceivedAmount(totalAmount.toString());
    } else {
      setReceivedAmount(prev => prev + val);
    }
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-60px)] bg-[#F8F6F1] font-sans">
      
      {/* --- Header --- */}
      <div className="h-[70px] bg-[#FDFBF7] border-b border-[#EAE5DF] flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-[#F4EFEA] rounded-full transition-colors text-[#302221]">
            <Icons.ArrowLeft />
          </button>
          <h1 className="text-xl font-bold text-[#302221]">เช็คบิล / ชำระเงิน</h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[#7B726B] font-bold">โต๊ะที่</p>
          <p className="text-lg font-bold text-[#302221] leading-none">Table 08</p>
        </div>
      </div>

      {/* --- Main Content --- */}
      <div className="flex flex-1 overflow-hidden p-6 gap-6">
        
        {/* ---------------- ซ้าย: สรุปรายการอาหาร ---------------- */}
        <div className="w-[340px] bg-[#FDFBF7] border border-[#EACEC8] rounded-xl flex flex-col shrink-0 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#EACEC8] bg-[#FAF5F3] flex justify-between items-center">
            <h2 className="font-bold text-[#302221]">รายการอาหาร</h2>
            <span className="text-xs text-[#7B726B] font-medium">8 รายการ</span>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* รายการจำลอง */}
            {[
              { name: 'ชุดเนื้อวากิวพรีเมียม (L)', qty: 2, price: '1,580.00' },
              { name: 'เซตผักรวมออร์แกนิก', qty: 1, price: '250.00' },
              { name: 'ซุปหม่าล่า & ซุปกระดูกหมู', qty: 1, price: '0.00' },
              { name: 'ลูกชิ้นกุ้งสด', qty: 3, price: '267.00' },
              { name: 'ชาเขียวรีฟิลล์', qty: 4, price: '156.00' },
            ].map((item, idx) => (
              <div key={idx} className="flex justify-between items-start pb-4 border-b border-dashed border-[#EACEC8] last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-bold text-[#302221]">{item.name}</p>
                  <p className="text-xs text-[#7B726B] mt-0.5">x{item.qty}</p>
                </div>
                <span className="text-sm font-mono font-medium text-[#555]">{item.price}</span>
              </div>
            ))}
          </div>

          <div className="px-6 py-5 border-t border-[#EACEC8] bg-[#FAF5F3] space-y-2">
            <div className="flex justify-between text-sm text-[#555]">
              <span>ยอดรวม (Subtotal)</span>
              <span className="font-mono">2,253.00</span>
            </div>
            <div className="flex justify-between text-sm text-[#555] pb-4 border-b border-[#5A403E]">
              <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
              <span className="font-mono">157.71</span>
            </div>
            <div className="flex justify-between items-end pt-2">
              <span className="font-bold text-[#302221] text-lg">ยอดสุทธิ<br/><span className="text-sm">(Total)</span></span>
              <span className="text-2xl font-bold font-mono text-[#5A403E]">฿ 2,410.71</span>
            </div>
          </div>
        </div>

        {/* ---------------- ขวา: วิธีชำระเงิน & เครื่องคิดเลข ---------------- */}
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
          
          {/* เลือกวิธีชำระเงิน */}
          <div className="flex gap-4">
            <button 
              onClick={() => setPaymentMethod('cash')}
              className={`flex-1 h-20 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all
                ${paymentMethod === 'cash' ? 'bg-[#5A403E] border-[#5A403E] text-white shadow-md' : 'bg-white border-[#EAE5DF] text-[#302221] hover:bg-gray-50'}`}
            >
              <Icons.Cash />
              <span className="text-sm font-bold">เงินสด (Cash)</span>
            </button>
            <button 
              onClick={() => setPaymentMethod('promptpay')}
              className={`flex-1 h-20 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all
                ${paymentMethod === 'promptpay' ? 'bg-[#5A403E] border-[#5A403E] text-white shadow-md' : 'bg-white border-[#EAE5DF] text-[#302221] hover:bg-gray-50'}`}
            >
              <Icons.QrCode />
              <span className="text-sm font-bold">พร้อมเพย์ (PromptPay)</span>
            </button>
            <button 
              onClick={() => setPaymentMethod('card')}
              className={`flex-1 h-20 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all
                ${paymentMethod === 'card' ? 'bg-[#5A403E] border-[#5A403E] text-white shadow-md' : 'bg-white border-[#EAE5DF] text-[#302221] hover:bg-gray-50'}`}
            >
              <Icons.CreditCard />
              <span className="text-sm font-bold">บัตรเครดิต (Credit Card)</span>
            </button>
          </div>

          {/* กล่องเครื่องคิดเลข */}
          <div className="flex-1 bg-white border border-[#EACEC8] rounded-xl p-8 flex gap-8 shadow-sm">
            
            {/* ซ้าย: แสดงตัวเลข */}
            <div className="flex-1 flex flex-col gap-6">
              <div>
                <label className="block text-sm font-bold text-[#555] mb-2">รับเงินมา (Amount Received)</label>
                <div className="h-16 border-2 border-[#5A403E] rounded-md px-4 flex items-center justify-end text-3xl font-mono font-bold text-[#302221]">
                  {receivedAmount ? parseFloat(receivedAmount).toLocaleString() : '0'}
                </div>
              </div>

              <div className="flex-1 bg-[#F4EFEA] rounded-xl flex flex-col justify-center items-center">
                <span className="text-lg font-bold text-[#5A403E] mb-2">เงินทอน<br/>(Change)</span>
                <span className="text-5xl font-bold font-mono text-[#5A403E]">
                  ฿ {change >= 0 ? change.toLocaleString(undefined, {minimumFractionDigits: 2}) : '0.00'}
                </span>
              </div>

              <div className="flex gap-4">
                <button onClick={() => handleNumpad('clear')} className="flex-1 py-3 bg-white border border-[#EACEC8] text-[#302221] font-bold rounded-md hover:bg-gray-50 transition-colors">
                  ล้างข้อมูล (Clear)
                </button>
                <button className="flex-1 py-3 bg-[#5A403E] text-white font-bold rounded-md hover:bg-[#4a322f] shadow-md transition-colors">
                  ยืนยันรับเงิน
                </button>
              </div>
            </div>

            {/* ขวา: Numpad */}
            <div className="w-[300px] flex flex-col gap-3 shrink-0 justify-center">
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9']
              ].map((row, i) => (
                <div key={i} className="flex gap-3 h-16">
                  {row.map(num => (
                    <button key={num} onClick={() => handleNumpad(num)} className="flex-1 bg-[#EAE5DF] rounded-md text-xl font-bold text-[#302221] hover:bg-[#d6d0c4] transition-colors shadow-sm">
                      {num}
                    </button>
                  ))}
                </div>
              ))}
              <div className="flex gap-3 h-16">
                <button onClick={() => handleNumpad('.')} className="flex-1 bg-[#EAE5DF] rounded-md text-xl font-bold text-[#302221] hover:bg-[#d6d0c4] transition-colors shadow-sm">.</button>
                <button onClick={() => handleNumpad('0')} className="flex-1 bg-[#EAE5DF] rounded-md text-xl font-bold text-[#302221] hover:bg-[#d6d0c4] transition-colors shadow-sm">0</button>
                <button onClick={() => handleNumpad('delete')} className="flex-1 bg-[#EAE5DF] flex items-center justify-center rounded-md text-[#302221] hover:bg-[#d6d0c4] transition-colors shadow-sm"><Icons.Delete /></button>
              </div>
              <button onClick={() => handleNumpad('exact')} className="w-full mt-2 h-16 bg-[#BDE4A7] hover:bg-[#9ccc81] rounded-md text-[#365922] font-bold text-lg shadow-sm transition-colors flex flex-col items-center justify-center leading-tight">
                ยอดเงินพอดี (Exact<br/>Amount)
              </button>
            </div>

          </div>

          {/* Action Buttons ด้านล่างสุด */}
          <div className="mt-auto">
            <button className="w-full py-5 bg-[#5A403E] hover:bg-[#4a322f] text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2">
              <Icons.CheckCircle /> ยืนยันการชำระเงิน (Confirm Payment)
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
