import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Calculator, FileText, Info, Plus, Trash2, User, UserCheck, X, Settings, AlertCircle, Lock, Unlock, Save, Calendar, CheckCircle2, Briefcase, Landmark, Users } from 'lucide-react';

// ==========================================
// 1. Firebase 初始化
// ==========================================
const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined') {
    return JSON.parse(__firebase_config);
  }
  return {
    apiKey: "AIzaSyDrfYEf3wmheX-f8WTo1w6Wx8AK1Vak7Do",
    authDomain: "salary-d6674.firebaseapp.com",
    projectId: "salary-d6674",
    storageBucket: "salary-d6674.firebasestorage.app",
    messagingSenderId: "549568332543",
    appId: "1:549568332543:web:2d74db9944f28222c3c2ca"
  };
};

const app = initializeApp(getFirebaseConfig());
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'demo-salary-app';

// ==========================================
// 輔助函式：取得指定月份的天數 (自動同步行事曆)
// ==========================================
const getDaysInMonth = (yyyymm) => {
  if (!yyyymm) return 30;
  const [year, month] = yyyymm.split('-');
  return new Date(year, month, 0).getDate();
};

// ==========================================
// 預設職位結構
// ==========================================
const DEFAULT_POSITIONS = [
  { id: 'p1', name: '外場-正職', A: 29500, B: 2000, C: 3000, D: 3500, labor: 700, health: 426, pension: 0 },
  { id: 'p2', name: '外場-教育員/副領班', A: 29500, B: 2000, C: 3000, D: 8500, labor: 700, health: 426, pension: 0 },
  { id: 'p3', name: '外場-領班', A: 29500, B: 2000, C: 3000, D: 5500, labor: 700, health: 426, pension: 0 }, 
  { id: 'p4', name: '經理', A: 29500, B: 2000, C: 3000, D: 10500, labor: 700, health: 426, pension: 0 }, 
];

// ==========================================
// 2. 主應用程式元件
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('employee'); 
  const [salaries, setSalaries] = useState([]);
  const [positions, setPositions] = useState(DEFAULT_POSITIONS);
  const [rules, setRules] = useState({
    dailyHours: 8,       
    minsPerHour: 60,     
    sickLeaveRate: 0.5,     
    personalLeaveRate: 1.0, 
    lateGraceMins: 0, 
    strictAttendance: true,
    bonusPenaltyRate: 0.35, 
    deductA: true, 
    deductC: true, 
    deductD: true  
  });
  
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [explanationModal, setExplanationModal] = useState({ isOpen: false, title: '', content: '' });
  
  const [toast, setToast] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    const config = getFirebaseConfig();
    if (config.apiKey === "YOUR_API_KEY" || config.projectId === "YOUR_PROJECT_ID") {
      setConfigError(true);
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("登入失敗:", error);
        setLoading(false); 
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || configError) return;

    const salariesRef = collection(db, 'artifacts', appId, 'public', 'data', 'salaries');
    const unsubSalaries = onSnapshot(salariesRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => b.month.localeCompare(a.month));
      setSalaries(data);
      setLoading(false);
    }, (error) => {
      console.error("讀取薪資失敗", error);
      setLoading(false);
    });

    const rulesRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'salaryRules');
    const unsubRules = onSnapshot(rulesRef, (docSnap) => {
      if (docSnap.exists()) {
        setRules(docSnap.data());
      }
    }, (error) => console.error("讀取規則失敗", error));

    const positionsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'salaryPositions');
    const unsubPositions = onSnapshot(positionsRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().list) {
        setPositions(docSnap.data().list);
      }
    }, (error) => console.error("讀取職位失敗", error));

    return () => {
      unsubSalaries();
      unsubRules();
      unsubPositions();
    };
  }, [user, configError]);

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg text-center border border-rose-100">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">金鑰設定錯誤</h2>
        </div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">系統載入中...</div>;

  const displaySalaries = role === 'admin' ? salaries : salaries.filter(s => s.employeeId === user?.uid);

  const openExplanation = (title, content) => {
    setExplanationModal({ isOpen: true, title, content });
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-12">
      <nav className="bg-blue-800 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Calculator className="h-6 w-6 text-blue-300" />
            <span className="text-xl font-bold tracking-wider">透明薪資系統</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-blue-900 rounded-full p-1 flex items-center">
              <button onClick={() => { setRole('employee'); setSelectedSalary(null); }} className={`px-3 py-1 text-sm rounded-full transition-colors flex items-center ${role === 'employee' ? 'bg-blue-600 text-white shadow' : 'text-blue-300 hover:text-white'}`}>
                <User size={14} className="mr-1" /> 員工自助區
              </button>
              <button onClick={() => { setRole('admin'); setSelectedSalary(null); }} className={`px-3 py-1 text-sm rounded-full transition-colors flex items-center ${role === 'admin' ? 'bg-amber-600 text-white shadow' : 'text-blue-300 hover:text-white'}`}>
                <Settings size={14} className="mr-1" /> 人資後台
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {selectedSalary ? (
          <SalaryReceipt salary={selectedSalary} onBack={() => setSelectedSalary(null)} openExplanation={openExplanation} />
        ) : (
          <div className="space-y-8">
            {role === 'admin' ? (
              <>
                {/* 修改點：將並排的網格 (grid-cols-3) 改為上下滿版的 Flex 容器 (flex-col) */}
                <div className="flex flex-col gap-6 mb-6">
                  <AdminRulesForm rules={rules} showToast={showToast} setConfirmDialog={setConfirmDialog} />
                  <AdminPositionsForm positions={positions} showToast={showToast} setConfirmDialog={setConfirmDialog} />
                </div>
                <AdminPublishForm user={user} rules={rules} positions={positions} showToast={showToast} />
              </>
            ) : (
              <EmployeeEstimator rules={rules} positions={positions} />
            )}
            
            {role === 'admin' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-blue-600" />
                    所有員工薪資紀錄
                  </h2>
                </div>
                
                {displaySalaries.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">目前沒有任何薪資紀錄。</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                          <th className="p-4 font-medium">計薪月份</th>
                          <th className="p-4 font-medium">職位</th>
                          <th className="p-4 font-medium">員工姓名</th>
                          <th className="p-4 font-medium text-right">實發金額</th>
                          <th className="p-4 font-medium text-center">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displaySalaries.map((s) => (
                          <tr key={s.id} className="hover:bg-blue-50/50 transition-colors">
                            <td className="p-4 font-medium text-slate-800">{s.month}</td>
                            <td className="p-4 text-slate-600">{s.positionName}</td>
                            <td className="p-4 text-slate-600">{s.employeeName}</td>
                            <td className="p-4 text-right font-bold text-blue-700">${s.netSalary.toLocaleString()}</td>
                            <td className="p-4 text-center space-x-2">
                              <button onClick={() => setSelectedSalary(s)} className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 px-3 py-1 rounded-md text-sm transition-colors">查看明細</button>
                              <button onClick={() => {
                                  setConfirmDialog({
                                    message: '確定要刪除這筆紀錄嗎？此動作無法復原。',
                                    onConfirm: async () => {
                                      try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'salaries', s.id)); showToast('資料已成功刪除'); } 
                                      catch(e) { showToast('刪除失敗，請稍後再試'); }
                                    }
                                  });
                                }} className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors">刪除</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 公式解釋與 Toast UI */}
      {explanationModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-blue-50 px-6 py-4 flex justify-between items-center border-b border-blue-100">
              <h3 className="font-bold text-blue-800 flex items-center"><Info className="w-5 h-5 mr-2 text-blue-600" />{explanationModal.title}</h3>
              <button onClick={() => setExplanationModal({ isOpen: false, title: '', content: '' })} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <div className="p-6 text-slate-700 leading-relaxed whitespace-pre-line">{explanationModal.content}</div>
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-3 rounded-lg shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4">{toast}</div>}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><AlertCircle className="w-5 h-5 mr-2 text-rose-500" />系統確認</h3>
            <p className="text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700">確定刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. 共用薪資計算邏輯核心 
// ==========================================
const calculateSalaryCore = (inputs, currentRules) => {
  const isPartTime = inputs.employmentType === 'partTime';
  const laborNum = Number(inputs.labor) || 0;
  const healthNum = Number(inputs.health) || 0;
  const pensionNum = Number(inputs.pension) || 0;
  const statutoryDeduction = laborNum + healthNum + pensionNum;

  if (isPartTime) {
    const ptSalary = Number(inputs.partTimeSalary) || 0;
    const ptLate = Number(inputs.partTimeLatePenalty) || 0;
    const grossSalary = ptSalary;
    const netSalary = grossSalary - ptLate - statutoryDeduction;

    return {
      employmentType: 'partTime',
      components: { ptSalary, labor: laborNum, health: healthNum, pension: pensionNum },
      deductions: { lateDeduction: ptLate, attendanceDeduction: ptLate, statutoryDeduction },
      grossSalary,
      totalDeduction: ptLate + statutoryDeduction,
      netSalary
    };
  }

  const { A, B, C, D, personalLeave, sickLeave, lateMinutes } = inputs;
  
  const baseDays = inputs.baseDays !== undefined ? inputs.baseDays : getDaysInMonth(inputs.month);
  const dailyHours = inputs.dailyHours !== undefined ? inputs.dailyHours : (currentRules.dailyHours || 8);
  const minsPerHour = inputs.minsPerHour !== undefined ? inputs.minsPerHour : (currentRules.minsPerHour || 60);
  const lateGraceMins = inputs.lateGraceMins !== undefined ? inputs.lateGraceMins : (currentRules.lateGraceMins || 0);
  
  const pRate = inputs.pRate !== undefined ? inputs.pRate : (currentRules.personalLeaveRate !== undefined ? currentRules.personalLeaveRate : 1.0);
  const sRate = inputs.sRate !== undefined ? inputs.sRate : (currentRules.sickLeaveRate !== undefined ? currentRules.sickLeaveRate : 0.5);
  const bonusPenaltyRate = currentRules.bonusPenaltyRate !== undefined ? currentRules.bonusPenaltyRate : 0.35;

  const dailyA = Math.round(A / baseDays);
  const dailyC = Math.round(C / baseDays);

  const deductA = currentRules.deductA !== false;
  const deductC = currentRules.deductC !== false;
  const deductD = currentRules.deductD !== false;

  const pDeductA = deductA ? Math.round(dailyA * personalLeave * pRate) : 0;
  const pDeductC = deductC ? Math.round(dailyC * personalLeave * pRate) : 0;
  const personalDeduction = pDeductA + pDeductC;

  const sDeductA = deductA ? Math.round(dailyA * sickLeave * sRate) : 0;
  const sDeductC = deductC ? Math.round(dailyC * sickLeave * sRate) : 0;
  const sickDeduction = sDeductA + sDeductC;

  const lateRatePerMin = (A / baseDays / dailyHours / minsPerHour);
  const billableLateMins = Math.max(0, lateMinutes - lateGraceMins);
  const lateDeduction = Math.round(lateRatePerMin * billableLateMins);

  let bDeduction = 0;
  if (currentRules.strictAttendance !== false && (personalLeave > 0 || sickLeave > 0 || billableLateMins > 0)) {
    bDeduction = B; 
  }

  let dDeduction = 0;
  if (deductD && (personalLeave > 0 || sickLeave > 0)) {
    dDeduction = Math.round(D * bonusPenaltyRate);
  }

  const grossSalary = A + B + C + D; 
  const attendanceDeduction = personalDeduction + sickDeduction + lateDeduction + bDeduction + dDeduction;
  const totalDeduction = attendanceDeduction + statutoryDeduction;
  const netSalary = grossSalary - totalDeduction;

  return {
    employmentType: 'fullTime',
    components: { A, B, C, D, labor: laborNum, health: healthNum, pension: pensionNum },
    deductions: {
      dailyA, dailyC, lateRatePerMin,
      pDeductA, pDeductC, personalDeduction,
      sDeductA, sDeductC, sickDeduction,
      lateDeduction, bDeduction, dDeduction, billableLateMins,
      attendanceDeduction, statutoryDeduction
    },
    grossSalary,
    totalDeduction,
    netSalary,
    rules: { pRate, sRate, bonusPenaltyRate, baseDays, dailyHours, minsPerHour, lateGraceMins, deductA, deductC, deductD, strictAttendance: currentRules.strictAttendance !== false }
  };
};

// ==========================================
// 共用元件：互動式公式填寫卡片
// ==========================================
function InteractiveFormulaCards({ inputs, setInputs, rules, result }) {
  const handleInput = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: Number(value) || 0 }));
  };

  const inputStyle = "w-16 sm:w-20 p-1 border border-blue-300 rounded text-center font-bold outline-none focus:ring-2 focus:border-transparent transition-all";

  if (inputs.employmentType === 'partTime') {
    return (
      <div className="space-y-4">
        <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm">
          <h4 className="font-bold text-emerald-700 mb-3 border-b border-emerald-50 pb-2 flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-1" /> 應發項目 (兼職薪資)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-medium text-slate-600 mb-4">
            <div>
              <label className="block mb-1 font-bold text-slate-800">出勤總薪資額 (NT$)</label>
              <input type="number" name="partTimeSalary" value={inputs.partTimeSalary} onChange={handleInput} className={`${inputStyle} w-full text-emerald-700 bg-emerald-50 focus:ring-emerald-400`} />
            </div>
            <div>
              <label className="block mb-1 font-bold text-rose-700">遲到扣除總額 (NT$)</label>
              <input type="number" name="partTimeLatePenalty" value={inputs.partTimeLatePenalty} onChange={handleInput} className={`${inputStyle} w-full text-rose-700 bg-rose-50 focus:ring-rose-400`} />
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100">
            <h5 className="font-bold text-slate-700 mb-2 flex items-center"><Landmark className="w-4 h-4 mr-1 text-slate-500" /> 法定扣除額</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div><label className="block text-xs mb-1 text-slate-500">勞保</label><input type="number" name="labor" value={inputs.labor || 0} onChange={handleInput} className={`${inputStyle} w-full bg-slate-50`} /></div>
              <div><label className="block text-xs mb-1 text-slate-500">健保</label><input type="number" name="health" value={inputs.health || 0} onChange={handleInput} className={`${inputStyle} w-full bg-slate-50`} /></div>
              <div><label className="block text-xs mb-1 text-slate-500">勞退</label><input type="number" name="pension" value={inputs.pension || 0} onChange={handleInput} className={`${inputStyle} w-full bg-slate-50`} /></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 sm:p-6 rounded-xl border border-blue-200 shadow-sm animate-in fade-in">
      <h4 className="font-bold text-blue-800 mb-4 border-b border-blue-50 pb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center text-lg"><Calculator className="w-5 h-5 mr-2" /> 薪資扣款</div>
        <span className="text-rose-600 font-bold bg-rose-50 px-3 py-1.5 rounded-lg text-sm shadow-sm border border-rose-100">
          扣款小計：- {(result.deductions.personalDeduction + result.deductions.sickDeduction + result.deductions.lateDeduction).toLocaleString()} 元
        </span>
      </h4>

      <div className="space-y-4 text-sm text-slate-700 font-mono overflow-x-auto pb-2">
        {/* 事假 */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="font-bold text-slate-800 w-20 shrink-0 flex items-center"><span className="w-2 h-2 rounded-full bg-rose-400 mr-2"></span>事假扣款</span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            【 底薪 <span className="text-blue-700 font-bold px-1">{inputs.A}</span> 元 ÷ 當月 <span className="text-blue-700 font-bold px-1">{inputs.baseDays}</span> 天 × 
            事假 <input name="personalLeave" value={inputs.personalLeave} onChange={handleInput} className={`${inputStyle} text-rose-600 bg-white border-rose-300 focus:ring-rose-400 shadow-sm`}/> 天 】
            {rules.deductC !== false && <span className="text-slate-400 text-xs ml-1">+ 餐費依比例</span>}
            <span className="font-bold text-rose-600 ml-2 text-base">= {result.deductions.personalDeduction.toLocaleString()} 元</span>
          </div>
        </div>

        {/* 病假 */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="font-bold text-slate-800 w-20 shrink-0 flex items-center"><span className="w-2 h-2 rounded-full bg-amber-400 mr-2"></span>病假扣款</span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            【 底薪 <span className="text-blue-700 font-bold px-1">{inputs.A}</span> 元 ÷ 當月 <span className="text-blue-700 font-bold px-1">{inputs.baseDays}</span> 天 × 
            病假 <input name="sickLeave" value={inputs.sickLeave} onChange={handleInput} className={`${inputStyle} text-amber-600 bg-white border-amber-300 focus:ring-amber-400 shadow-sm`}/> 天 ×
            乘數 <span className="text-amber-600 font-bold px-1">{inputs.sRate}</span> 】
            {rules.deductC !== false && <span className="text-slate-400 text-xs ml-1">+ 餐費依比例</span>}
            <span className="font-bold text-rose-600 ml-2 text-base">= {result.deductions.sickDeduction.toLocaleString()} 元</span>
          </div>
        </div>

        {/* 遲到 */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="font-bold text-slate-800 w-20 shrink-0 flex items-center"><span className="w-2 h-2 rounded-full bg-blue-400 mr-2"></span>遲到扣款</span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            【 底薪 <span className="text-blue-700 font-bold px-1">{inputs.A}</span> 元 ÷ 當月 <span className="text-blue-700 font-bold px-1">{inputs.baseDays}</span> 天 ÷
            <span className="text-blue-700 font-bold px-1">{inputs.dailyHours}</span> 小時 ÷ <span className="text-blue-700 font-bold px-1">{inputs.minsPerHour}</span> 分 ×
            ( 遲到 <input name="lateMinutes" value={inputs.lateMinutes} onChange={handleInput} className={`${inputStyle} text-rose-600 bg-white border-rose-300 focus:ring-rose-400 shadow-sm`}/> 分 - 
            寬限 <span className="text-emerald-600 font-bold px-1">{inputs.lateGraceMins}</span> 分 ) 】
            <span className="font-bold text-rose-600 ml-2 text-base">= {result.deductions.lateDeduction.toLocaleString()} 元</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. 員工自助試算器元件
// ==========================================
function EmployeeEstimator({ rules, positions }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [inputs, setInputs] = useState({ 
    month: currentMonth,
    employmentType: 'fullTime',
    positionId: positions.length > 0 ? positions[0].id : '', 
    personalLeave: 0, sickLeave: 0, lateMinutes: 0,
    partTimeSalary: 0, partTimeLatePenalty: 0,
    labor: 0, health: 0, pension: 0
  });

  useEffect(() => {
    if (inputs.employmentType === 'fullTime' && positions.length > 0 && inputs.positionId) {
      const pos = positions.find(p => p.id === inputs.positionId) || positions[0];
      setInputs(prev => ({ 
        ...prev, 
        labor: pos.labor || 0, 
        health: pos.health || 0, 
        pension: pos.pension || 0,
        baseDays: getDaysInMonth(prev.month) 
      }));
    } else {
       setInputs(prev => ({ ...prev, baseDays: getDaysInMonth(prev.month) }));
    }
  }, [inputs.positionId, inputs.employmentType, inputs.month, positions]);
  
  const handleInput = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: name === 'positionId' || name === 'employmentType' || name === 'month' ? value : (Number(value) || 0) }));
  };

  const position = positions.find(p => p.id === inputs.positionId) || positions[0] || { A: 0, B: 0, C: 0, D: 0, labor: 0, health: 0, pension: 0 };
  const calcPayload = {
    ...inputs,
    A: position.A, B: position.B, C: position.C, D: position.D,
  };
  
  const result = calculateSalaryCore(calcPayload, rules);

  return (
    <div className="bg-white rounded-xl shadow-md border border-blue-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-800 flex justify-between items-center text-white">
        <h2 className="text-lg font-bold flex items-center">
          <Calculator className="w-5 h-5 mr-2" /> 員工專屬 - 當月薪資試算器
        </h2>
      </div>
      <div className="p-6">
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button onClick={() => setInputs(prev => ({...prev, employmentType: 'fullTime'}))} className={`px-5 py-2 rounded-md text-sm font-bold transition-all ${inputs.employmentType === 'fullTime' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>正職員工</button>
            <button onClick={() => setInputs(prev => ({...prev, employmentType: 'partTime'}))} className={`px-5 py-2 rounded-md text-sm font-bold transition-all ${inputs.employmentType === 'partTime' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>兼職/計時人員</button>
          </div>
          <div className="flex-1 max-w-xs">
             <label className="block text-xs font-bold text-slate-500 mb-1">同步行政院行事曆 (計薪月份)</label>
             <input type="month" name="month" value={inputs.month} onChange={handleInput} className="w-full border-slate-300 rounded-md shadow-sm border p-2 text-sm bg-white font-medium" />
          </div>
        </div>

        <p className="text-sm text-slate-500 mb-6 flex items-start bg-blue-50 p-3 rounded-lg border border-blue-100">
          <Info className="w-5 h-5 mr-2 text-blue-500 flex-shrink-0" />
          在此輸入您的請假與出勤狀況，系統將自動擷取該月實際天數（{result.rules.baseDays}天）並套用最新規則進行試算。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          {inputs.employmentType === 'fullTime' ? (
            <>
              <div><label className="block text-sm font-bold text-slate-700 mb-1">我的職位</label><select name="positionId" value={inputs.positionId} onChange={handleInput} className="w-full border-slate-300 rounded-md shadow-sm border p-2 bg-white font-medium">{positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">事假 (天)</label><input type="number" name="personalLeave" value={inputs.personalLeave} onChange={handleInput} min="0" className="w-full border-slate-300 rounded-md shadow-sm border p-2" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">病假 (天)</label><input type="number" name="sickLeave" value={inputs.sickLeave} onChange={handleInput} min="0" className="w-full border-slate-300 rounded-md shadow-sm border p-2" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">遲到 (分鐘)</label><input type="number" name="lateMinutes" value={inputs.lateMinutes} onChange={handleInput} min="0" className="w-full border-slate-300 rounded-md shadow-sm border p-2" /></div>
            </>
          ) : (
            <>
              <div className="md:col-span-2"><label className="block text-sm font-bold text-slate-700 mb-1">出勤總薪資額 (NT$)</label><input type="number" name="partTimeSalary" value={inputs.partTimeSalary} onChange={handleInput} min="0" className="w-full border-slate-300 rounded-md shadow-sm border p-2 font-medium" /></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">遲到扣款總額 (NT$)</label><input type="number" name="partTimeLatePenalty" value={inputs.partTimeLatePenalty} onChange={handleInput} min="0" className="w-full border-slate-300 rounded-md shadow-sm border p-2" /></div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 px-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">勞保自付額 (依職位固定)</label>
            <input type="number" name="labor" value={inputs.labor} readOnly className="w-full border-slate-200 rounded text-sm p-1.5 bg-slate-200/70 text-slate-500 cursor-not-allowed font-medium shadow-inner" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">健保自付額 (依職位固定)</label>
            <input type="number" name="health" value={inputs.health} readOnly className="w-full border-slate-200 rounded text-sm p-1.5 bg-slate-200/70 text-slate-500 cursor-not-allowed font-medium shadow-inner" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">代扣勞退/自提 {inputs.employmentType === 'fullTime' ? '(固定)' : '(可微調)'}</label>
            <input 
              type="number" 
              name="pension" 
              value={inputs.pension} 
              onChange={inputs.employmentType === 'partTime' ? handleInput : undefined} 
              readOnly={inputs.employmentType === 'fullTime'} 
              min="0" 
              className={`w-full border-slate-200 rounded text-sm p-1.5 font-medium transition-colors ${inputs.employmentType === 'fullTime' ? 'bg-slate-200/70 text-slate-500 cursor-not-allowed shadow-inner' : 'bg-white focus:ring-blue-500 shadow-sm'}`} 
            />
          </div>
        </div>

        {/* 試算結果呈現 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-bl-lg">試算結果總結</div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-slate-700 font-bold mb-3 border-b pb-2">基本薪資總額</h4>
              <ul className="space-y-2 text-sm">
                {inputs.employmentType === 'fullTime' ? (
                  <>
                    <li className="flex justify-between text-slate-600"><span>底薪 (A)</span> <span>${result.components.A.toLocaleString()}</span></li>
                    <li className="flex justify-between text-slate-600"><span>全勤 (B)</span> <span>${result.components.B.toLocaleString()}</span></li>
                    <li className="flex justify-between text-slate-600"><span>餐費 (C)</span> <span>${result.components.C.toLocaleString()}</span></li>
                    <li className="flex justify-between text-slate-600"><span>紅利 (D)</span> <span>${result.components.D.toLocaleString()}</span></li>
                  </>
                ) : (
                  <li className="flex justify-between text-slate-600 font-bold"><span>出勤總薪資</span> <span>${result.components.ptSalary?.toLocaleString()}</span></li>
                )}
              </ul>
              <div className="mt-2 pt-2 border-t flex justify-between font-bold text-slate-800">
                <span>應發合計</span><span>${result.grossSalary.toLocaleString()}</span>
              </div>
            </div>
            
            <div>
              <h4 className="text-slate-700 font-bold mb-3 border-b pb-2">出勤扣除項</h4>
              <ul className="space-y-2 text-sm">
                {inputs.employmentType === 'fullTime' ? (
                  <>
                    <li className="flex justify-between text-rose-600"><span>事假扣除</span> <span>-${result.deductions.personalDeduction.toLocaleString()}</span></li>
                    <li className="flex justify-between text-rose-600"><span>病假扣除</span> <span>-${result.deductions.sickDeduction.toLocaleString()}</span></li>
                    <li className="flex justify-between text-rose-600"><span>取消全勤</span> <span>-${result.deductions.bDeduction.toLocaleString()}</span></li>
                    <li className="flex justify-between text-rose-600"><span>紅利扣除</span> <span>-${result.deductions.dDeduction.toLocaleString()}</span></li>
                    <li className="flex justify-between text-rose-600"><span>遲到扣款</span> <span>-${result.deductions.lateDeduction.toLocaleString()}</span></li>
                  </>
                ) : (
                  <li className="flex justify-between text-rose-600"><span>遲到扣款總額</span> <span>-${result.deductions.lateDeduction.toLocaleString()}</span></li>
                )}
              </ul>
              <div className="mt-2 pt-2 border-t flex justify-between font-bold text-rose-700">
                <span>出勤扣款小計</span><span>-${result.deductions.attendanceDeduction.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <h4 className="text-slate-700 font-bold mb-3 border-b pb-2">法定扣除額</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between text-slate-500"><span>勞保費</span> <span>-${result.components.labor.toLocaleString()}</span></li>
                <li className="flex justify-between text-slate-500"><span>健保費</span> <span>-${result.components.health.toLocaleString()}</span></li>
                <li className="flex justify-between text-slate-500"><span>代扣勞退</span> <span>-${result.components.pension.toLocaleString()}</span></li>
              </ul>
              <div className="mt-2 pt-2 border-t flex justify-between font-bold text-slate-600">
                <span>法定扣款小計</span><span>-${result.deductions.statutoryDeduction.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div className="pt-5 mt-5 border-t-2 border-dashed border-slate-200 font-bold text-blue-800 text-2xl flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
            <span>= 預估實發金額：</span>
            <span>${result.netSalary.toLocaleString()}</span>
          </div>
          
          {inputs.employmentType === 'fullTime' && (
            <div className="mt-6 bg-blue-50/50 border border-blue-200 rounded-xl p-5">
              <h4 className="text-blue-800 font-bold mb-3 flex items-center">
                <Calculator className="w-5 h-5 mr-2" /> 系統計算公式透明化
              </h4>
              <div className="text-sm text-slate-700 space-y-2 font-mono bg-white p-4 rounded-lg border border-blue-100 shadow-sm overflow-x-auto">
                <p className="text-slate-500 font-bold">【薪水公式】：總額 - 出勤扣款 - 法定扣款 = 實發薪水</p>
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <p>基本總額：${result.grossSalary.toLocaleString()} (底薪+全勤+餐費+紅利)</p>
                  {inputs.personalLeave > 0 && result.deductions.personalDeduction > 0 && <p className="text-rose-600 mt-1 whitespace-nowrap">- 事假扣除：{[result.rules.deductA ? `(底薪 ${result.components.A} ÷ ${result.rules.baseDays} × ${inputs.personalLeave}天)` : null, result.rules.deductC ? `(餐費 ${result.components.C} ÷ ${result.rules.baseDays} × ${inputs.personalLeave}天)` : null].filter(Boolean).join(' + ')} = {result.deductions.personalDeduction.toLocaleString()} 元</p>}
                  {inputs.sickLeave > 0 && result.deductions.sickDeduction > 0 && <p className="text-rose-600 mt-1 whitespace-nowrap">- 病假扣除：{[result.rules.deductA ? `(底薪 ${result.components.A} ÷ ${result.rules.baseDays} × ${inputs.sickLeave}天 × ${result.rules.sRate})` : null, result.rules.deductC ? `(餐費 ${result.components.C} ÷ ${result.rules.baseDays} × ${inputs.sickLeave}天 × ${result.rules.sRate})` : null].filter(Boolean).join(' + ')} = {result.deductions.sickDeduction.toLocaleString()} 元</p>}
                  {result.deductions.bDeduction > 0 && <p className="text-rose-600 mt-1">- 取消全勤：扣除 {result.deductions.bDeduction.toLocaleString()} 元</p>}
                  {result.deductions.dDeduction > 0 && <p className="text-rose-600 mt-1">- 紅利扣除：紅利 {result.components.D} × {result.rules.bonusPenaltyRate * 100}% = {result.deductions.dDeduction.toLocaleString()} 元</p>}
                  
                  {inputs.lateMinutes > 0 && result.deductions.lateDeduction > 0 && <p className="text-rose-600 mt-1 whitespace-nowrap">- 遲到扣除：(底薪 {result.components.A} ÷ {result.rules.baseDays}天 ÷ {result.rules.dailyHours}小時 ÷ {result.rules.minsPerHour}分) × (遲到 {inputs.lateMinutes} 分 - 寬限 {result.rules.lateGraceMins} 分) = {result.deductions.lateDeduction.toLocaleString()} 元</p>}
                  {inputs.lateMinutes > 0 && result.deductions.lateDeduction === 0 && <p className="text-emerald-600 mt-1 whitespace-nowrap">- 遲到免扣款：遲到 {inputs.lateMinutes} 分鐘 (在寬限期 {result.rules.lateGraceMins} 分鐘內)</p>}

                  {result.deductions.statutoryDeduction > 0 && <p className="text-slate-500 mt-2 pt-2 border-t border-slate-100">- 法定扣除：勞保 {result.components.labor} + 健保 {result.components.health} + 勞退 {result.components.pension} = {result.deductions.statutoryDeduction.toLocaleString()} 元</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 5. 人資後台設定規則元件
// ==========================================
function AdminRulesForm({ rules, showToast, setConfirmDialog }) {
  const [localRules, setLocalRules] = useState(rules);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => { setLocalRules(rules); }, [rules]);

  const handleSave = () => {
    setConfirmDialog({
      message: '確定要儲存新的計薪規則嗎？這將作為所有員工試算與發布時的「預設載入值」。',
      onConfirm: async () => {
        setSaving(true);
        try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'salaryRules'), localRules);
          showToast('全域計薪規則已更新！');
          setIsLocked(true); 
        } catch(e) {
          showToast('更新失敗，請確認連線。');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const handleCheckbox = (key) => {
    if (isLocked) return;
    setLocalRules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden h-full flex flex-col relative">
      <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex justify-between items-center z-20 relative">
        <div className="flex items-center">
          <Settings className="w-5 h-5 mr-2 text-amber-700" />
          <h2 className="text-lg font-bold text-amber-800">全域預設參數站</h2>
        </div>
        <button
          onClick={() => setIsLocked(!isLocked)}
          className={`flex items-center text-sm px-3 py-1.5 rounded-full transition-colors font-medium ${isLocked ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 shadow-sm' : 'bg-rose-100 text-rose-700 hover:bg-rose-200 shadow-sm'}`}
        >
          {isLocked ? <><Lock size={14} className="mr-1"/> 解鎖編輯</> : <><Unlock size={14} className="mr-1"/> 鎖定防護</>}
        </button>
      </div>

      <div className="p-5 space-y-4 relative flex-1 bg-slate-50/50">
        {isLocked && <div className="absolute inset-0 bg-slate-100/30 z-10 cursor-not-allowed rounded-b-xl" title="請先點擊右上角解鎖編輯"></div>}

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-blue-600"/> 假別與遲到換算基準 (表單預設)
          </h3>
          
          <div className="mb-3 text-xs bg-blue-50 text-blue-800 p-2 rounded-lg font-medium border border-blue-100">
            💡 計薪天數：系統已自動與您選擇的【計薪月份】實際天數同步 (如 28, 30, 31 天)。
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4 border-b border-slate-100 pb-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">一日工時</label>
              <input type="number" value={localRules.dailyHours || 8} onChange={e => setLocalRules({...localRules, dailyHours: Number(e.target.value)})} disabled={isLocked} className="w-full border-slate-300 rounded-md border p-2 text-sm disabled:bg-slate-50 focus:ring-amber-500 font-medium" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">一小時分</label>
              <input type="number" value={localRules.minsPerHour || 60} onChange={e => setLocalRules({...localRules, minsPerHour: Number(e.target.value)})} disabled={isLocked} className="w-full border-slate-300 rounded-md border p-2 text-sm disabled:bg-slate-50 focus:ring-amber-500 font-medium" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">事假乘數</label>
              <input type="number" step="0.1" value={localRules.personalLeaveRate !== undefined ? localRules.personalLeaveRate : 1.0} onChange={e => setLocalRules({...localRules, personalLeaveRate: Number(e.target.value)})} disabled={isLocked} className="w-full border-slate-300 rounded-md border p-2 text-sm disabled:bg-slate-50 focus:ring-amber-500 font-medium" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">病假乘數</label>
              <input type="number" step="0.1" value={localRules.sickLeaveRate !== undefined ? localRules.sickLeaveRate : 0.5} onChange={e => setLocalRules({...localRules, sickLeaveRate: Number(e.target.value)})} disabled={isLocked} className="w-full border-slate-300 rounded-md border p-2 text-sm disabled:bg-slate-50 focus:ring-amber-500 font-medium" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">遲到寬限期(分)</label>
              <input type="number" value={localRules.lateGraceMins || 0} onChange={e => setLocalRules({...localRules, lateGraceMins: Number(e.target.value)})} disabled={isLocked} title="可容許遲到分鐘數，設為0即無寬限期" className="w-full border-slate-300 rounded-md border p-2 text-sm disabled:bg-slate-50 focus:ring-emerald-500 text-emerald-700 font-bold" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-3 mt-1 flex items-center">
            <Calculator className="w-4 h-4 mr-2 text-rose-600"/> 缺勤扣除項目啟用/關閉
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div onClick={() => handleCheckbox('deductA')} className={`p-4 rounded-xl border flex flex-col justify-center gap-2 transition-all cursor-pointer ${localRules.deductA !== false ? 'bg-white border-blue-300 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
              <div className="flex items-center space-x-3"><input type="checkbox" checked={localRules.deductA !== false} readOnly disabled={isLocked} className="w-5 h-5 rounded text-blue-600" /><div><div className="font-bold text-slate-800 text-sm">請假時扣除底薪 (A)</div></div></div>
            </div>
            <div onClick={() => handleCheckbox('deductC')} className={`p-4 rounded-xl border flex flex-col justify-center gap-2 transition-all cursor-pointer ${localRules.deductC !== false ? 'bg-white border-blue-300 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
              <div className="flex items-center space-x-3"><input type="checkbox" checked={localRules.deductC !== false} readOnly disabled={isLocked} className="w-5 h-5 rounded text-blue-600" /><div><div className="font-bold text-slate-800 text-sm">請假時扣除餐費 (C)</div></div></div>
            </div>
            <div onClick={() => handleCheckbox('strictAttendance')} className={`p-4 rounded-xl border flex flex-col justify-center gap-2 transition-all cursor-pointer ${localRules.strictAttendance !== false ? 'bg-white border-amber-300 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
              <div className="flex items-center space-x-3"><input type="checkbox" checked={localRules.strictAttendance !== false} readOnly disabled={isLocked} className="w-5 h-5 rounded text-amber-600" /><div><div className="font-bold text-slate-800 text-sm">有缺勤紀錄即取消全勤 (B)</div></div></div>
            </div>
            <div className={`p-4 rounded-xl border flex flex-col justify-center gap-2 transition-all ${localRules.deductD !== false ? 'bg-white border-rose-300 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
              <div className="flex items-center space-x-3 w-full">
                <input type="checkbox" checked={localRules.deductD !== false} onChange={() => handleCheckbox('deductD')} disabled={isLocked} className="w-5 h-5 rounded text-rose-600 cursor-pointer" />
                <div className="flex-1">
                  <div className="font-bold text-slate-800 text-sm cursor-pointer" onClick={() => handleCheckbox('deductD')}>請假時扣除紅利 (D)</div>
                  <div className="text-xs text-slate-500 font-mono mt-1 flex items-center">
                    扣除比例 <input type="number" value={(localRules.bonusPenaltyRate !== undefined ? localRules.bonusPenaltyRate : 0.35) * 100} onChange={e => setLocalRules({...localRules, bonusPenaltyRate: Number(e.target.value)/100})} disabled={isLocked || localRules.deductD === false} className="w-12 mx-1 border-slate-300 rounded p-0.5 text-center font-bold text-rose-700 bg-rose-50 focus:ring-rose-500" /> %
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!isLocked && (
          <button onClick={handleSave} disabled={saving} className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg transition-colors font-bold shadow-md flex items-center justify-center animate-in fade-in zoom-in-95 duration-200 z-20 relative">
            {saving ? '儲存中...' : <><Save size={18} className="mr-2"/> 儲存預設參數</>}
          </button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 5.5 人資後台職位管理元件
// ==========================================
function AdminPositionsForm({ positions, showToast, setConfirmDialog }) {
  const [localPositions, setLocalPositions] = useState(positions);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => { setLocalPositions(positions); }, [positions]);

  const handleSave = () => {
    setConfirmDialog({
      message: '確定要儲存職位設定嗎？這將會更新所有員工試算及發布表單的職位選單。',
      onConfirm: async () => {
        setSaving(true);
        try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'salaryPositions'), { list: localPositions });
          showToast('職位結構已更新！');
          setIsLocked(true);
        } catch(e) {
          showToast('更新失敗，請確認連線。');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const addPosition = () => {
    if (isLocked) return;
    const newId = 'p' + Date.now();
    setLocalPositions([...localPositions, { id: newId, name: '新職位 (請命名)', A: 29500, B: 2000, C: 3000, D: 0, labor: 700, health: 426, pension: 0 }]);
  };

  const removePosition = (id) => {
    if (isLocked) return;
    if(localPositions.length <= 1) {
        showToast('系統中至少需要保留一個職位！');
        return;
    }
    setConfirmDialog({
      message: '確認刪除此職位嗎？',
      onConfirm: () => {
        setLocalPositions(localPositions.filter(p => p.id !== id));
      }
    });
  };

  const handleChange = (id, field, value) => {
    if (isLocked) return;
    setLocalPositions(localPositions.map(p => p.id === id ? { ...p, [field]: field === 'name' ? value : (Number(value) || 0) } : p));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden relative h-full flex flex-col">
      <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-200 flex justify-between items-center z-20 relative">
        <div className="flex items-center">
          <Briefcase className="w-5 h-5 mr-2 text-emerald-700" />
          <h2 className="text-lg font-bold text-emerald-800">職位薪資結構管理</h2>
        </div>
        <button
          onClick={() => setIsLocked(!isLocked)}
          className={`flex items-center text-sm px-3 py-1.5 rounded-full transition-colors font-medium ${isLocked ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 shadow-sm' : 'bg-rose-100 text-rose-700 hover:bg-rose-200 shadow-sm'}`}
        >
          {isLocked ? <><Lock size={14} className="mr-1"/> 解鎖編輯</> : <><Unlock size={14} className="mr-1"/> 鎖定防護</>}
        </button>
      </div>

      <div className="p-6 relative bg-slate-50/30 overflow-x-auto flex-1">
        {isLocked && <div className="absolute inset-0 bg-slate-100/30 z-10 cursor-not-allowed" title="請先點擊右上角解鎖編輯"></div>}
        
        <div className="space-y-4 min-w-[900px]">
          {localPositions.map((pos) => (
            <div key={pos.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 transition-colors flex items-center justify-between gap-4">
              <div className="w-1/4 min-w-[150px]">
                <label className="block text-xs font-bold text-slate-500 mb-1">職位名稱</label>
                <input type="text" value={pos.name} onChange={e => handleChange(pos.id, 'name', e.target.value)} disabled={isLocked} className="w-full border-slate-300 rounded-md border p-2 text-sm focus:ring-emerald-500 disabled:bg-slate-50 font-medium text-slate-800" />
              </div>
              
              <div className="flex-1 grid grid-cols-7 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-500 mb-1 text-center">底薪(A)</label><input type="number" value={pos.A} onChange={e => handleChange(pos.id, 'A', e.target.value)} disabled={isLocked} className="w-full border-slate-200 rounded border p-1.5 text-sm text-center font-medium" /></div>
                <div><label className="block text-[10px] font-bold text-slate-500 mb-1 text-center">全勤(B)</label><input type="number" value={pos.B} onChange={e => handleChange(pos.id, 'B', e.target.value)} disabled={isLocked} className="w-full border-slate-200 rounded border p-1.5 text-sm text-center font-medium" /></div>
                <div><label className="block text-[10px] font-bold text-slate-500 mb-1 text-center">餐費(C)</label><input type="number" value={pos.C} onChange={e => handleChange(pos.id, 'C', e.target.value)} disabled={isLocked} className="w-full border-slate-200 rounded border p-1.5 text-sm text-center font-medium" /></div>
                <div><label className="block text-[10px] font-bold text-slate-500 mb-1 text-center">紅利(D)</label><input type="number" value={pos.D} onChange={e => handleChange(pos.id, 'D', e.target.value)} disabled={isLocked} className="w-full border-slate-200 rounded border p-1.5 text-sm text-center font-medium" /></div>
                <div><label className="block text-[10px] font-bold text-blue-500 mb-1 text-center">勞保自付額</label><input type="number" value={pos.labor || 0} onChange={e => handleChange(pos.id, 'labor', e.target.value)} disabled={isLocked} className="w-full border-blue-200 rounded border p-1.5 text-sm bg-blue-50/30 text-center font-medium" /></div>
                <div><label className="block text-[10px] font-bold text-blue-500 mb-1 text-center">健保自付額</label><input type="number" value={pos.health || 0} onChange={e => handleChange(pos.id, 'health', e.target.value)} disabled={isLocked} className="w-full border-blue-200 rounded border p-1.5 text-sm bg-blue-50/30 text-center font-medium" /></div>
                <div><label className="block text-[10px] font-bold text-blue-500 mb-1 text-center">代扣勞退</label><input type="number" value={pos.pension || 0} onChange={e => handleChange(pos.id, 'pension', e.target.value)} disabled={isLocked} className="w-full border-blue-200 rounded border p-1.5 text-sm bg-blue-50/30 text-center font-medium" /></div>
              </div>

              <div className="w-10 flex justify-center mt-4">
                <button onClick={() => removePosition(pos.id)} disabled={isLocked} className="text-slate-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50" title="刪除此職位">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {!isLocked && (
          <div className="mt-6 flex flex-col sm:flex-row gap-4 z-20 relative">
            <button onClick={addPosition} className="flex-1 bg-white border-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 py-3 rounded-xl transition-colors font-bold flex items-center justify-center">
              <Plus size={18} className="mr-2"/> 新增職位
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl transition-colors font-bold shadow-md flex items-center justify-center">
              {saving ? '儲存中...' : <><Save size={18} className="mr-2"/> 儲存職位變更</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 6. 人資發布薪資表單 
// ==========================================
function AdminPublishForm({ user, rules, positions, showToast }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [formData, setFormData] = useState({
    employmentType: 'fullTime',
    month: currentMonth,
    employeeName: '',
    positionId: positions.length > 0 ? positions[0].id : '',
    A: 0, B: 0, C: 0, D: 0,
    labor: 0, health: 0, pension: 0,
    personalLeave: 0, sickLeave: 0, lateMinutes: 0,
    partTimeSalary: 0, partTimeLatePenalty: 0,
    baseDays: getDaysInMonth(currentMonth), 
    dailyHours: 8, minsPerHour: 60,
    lateGraceMins: 0,
    pRate: 1.0, sRate: 0.5
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (positions.length > 0 && formData.A === 0 && formData.B === 0) {
      const pos = positions.find(p => p.id === formData.positionId) || positions[0];
      setFormData(prev => ({ 
        ...prev, 
        positionId: pos.id, 
        A: pos.A, B: pos.B, C: pos.C, D: pos.D,
        labor: pos.labor || 0, health: pos.health || 0, pension: pos.pension || 0
      }));
    }
  }, [positions]);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      baseDays: getDaysInMonth(prev.month), 
      dailyHours: rules.dailyHours || 8,
      minsPerHour: rules.minsPerHour || 60,
      lateGraceMins: rules.lateGraceMins || 0,
      pRate: rules.personalLeaveRate !== undefined ? rules.personalLeaveRate : 1.0,
      sRate: rules.sickLeaveRate !== undefined ? rules.sickLeaveRate : 0.5
    }));
  }, [rules, formData.month]);

  const handlePositionChange = (e) => {
    const posId = e.target.value;
    const pos = positions.find(p => p.id === posId) || positions[0] || { A:0, B:0, C:0, D:0, labor:0, health:0, pension:0 };
    setFormData(prev => ({ 
      ...prev, positionId: posId, A: pos.A, B: pos.B, C: pos.C, D: pos.D,
      labor: pos.labor || 0, health: pos.health || 0, pension: pos.pension || 0
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const calcResult = calculateSalaryCore(formData, rules);
      const position = positions.find(p => p.id === formData.positionId) || { name: formData.employmentType === 'partTime' ? '兼職員工' : '自訂職位' };
      
      const finalData = {
        ...formData,
        positionName: position.name,
        employeeId: user.uid, 
        rulesSnapshot: rules, 
        calcResult,
        netSalary: calcResult.netSalary,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'salaries'), finalData);
      showToast('薪資單正式發布成功！');
    } catch (error) {
      showToast('發布失敗，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInput = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'month' || name === 'employeeName' ? value : (Number(value) || 0) }));
  };

  const calcResult = calculateSalaryCore(formData, rules);
  const inputStyle = "w-16 p-1 border border-blue-300 rounded text-center font-bold outline-none focus:ring-2 focus:border-transparent transition-all";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center">
          <FileText className="w-5 h-5 mr-2 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-800">正式發布薪資單</h2>
        </div>
        <div className="flex space-x-2 bg-slate-200 p-1 rounded-lg">
          <button type="button" onClick={() => setFormData(prev => ({...prev, employmentType: 'fullTime'}))} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${formData.employmentType === 'fullTime' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>正職員工</button>
          <button type="button" onClick={() => setFormData(prev => ({...prev, employmentType: 'partTime'}))} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${formData.employmentType === 'partTime' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>兼職員工</button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 flex-1 flex flex-col justify-between overflow-y-auto bg-slate-50/50">
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div><label className="block text-sm font-bold text-slate-700 mb-1">計薪月份 (自動同步天數)</label><input type="month" name="month" value={formData.month} onChange={handleInput} className="w-full border-slate-300 border p-2 rounded-lg bg-blue-50/30 focus:ring-blue-500" required /></div>
            <div><label className="block text-sm font-bold text-slate-700 mb-1">員工姓名</label><input type="text" name="employeeName" value={formData.employeeName} onChange={handleInput} className="w-full border-slate-300 border p-2 rounded-lg" required placeholder="例如：王小明" /></div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">職位設定/參考載入</label>
              <select value={formData.positionId} onChange={handlePositionChange} className="w-full border-slate-300 border p-2 rounded-lg bg-white font-medium">
                {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          
          {formData.employmentType === 'partTime' ? (
             <div className="bg-white p-5 sm:p-6 rounded-xl border border-blue-200 shadow-sm mb-6 animate-in fade-in">
               <h4 className="font-bold text-blue-800 mb-4 border-b border-blue-50 pb-2 flex items-center"><Calculator className="w-5 h-5 mr-2" /> 兼職薪資與扣款設定</h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                 <div><label className="block text-sm font-bold text-emerald-700 mb-2">出勤總薪資額 (NT$)</label><input type="number" name="partTimeSalary" value={formData.partTimeSalary} onChange={handleInput} className="w-full border-slate-300 border p-3 rounded-lg text-lg font-bold text-emerald-700 bg-emerald-50" /></div>
                 <div><label className="block text-sm font-bold text-rose-700 mb-2">遲到扣除總額 (NT$)</label><input type="number" name="partTimeLatePenalty" value={formData.partTimeLatePenalty} onChange={handleInput} className="w-full border-slate-300 border p-3 rounded-lg text-lg font-bold text-rose-700 bg-rose-50" /></div>
               </div>
             </div>
          ) : (
            <div className="bg-white p-5 sm:p-6 rounded-xl border border-blue-200 shadow-sm mb-6 animate-in fade-in">
              <h4 className="font-bold text-blue-800 mb-4 border-b border-blue-50 pb-3 flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center text-lg"><Calculator className="w-5 h-5 mr-2" /> 薪資扣款 (單一整合卡片)</div>
                <span className="text-rose-600 font-bold bg-rose-50 px-3 py-1.5 rounded-lg text-sm shadow-sm border border-rose-100">
                  扣款小計：- {(calcResult.deductions.personalDeduction + calcResult.deductions.sickDeduction + calcResult.deductions.lateDeduction).toLocaleString()} 元
                </span>
              </h4>

              <div className="space-y-4 text-sm text-slate-700 font-mono overflow-x-auto pb-2">
                <div className="flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-800 w-20 shrink-0 flex items-center"><span className="w-2 h-2 rounded-full bg-rose-400 mr-2"></span>事假扣款</span>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    【 底薪 <span className="text-blue-700 font-bold px-1">{formData.A}</span> 元 ÷ 當月 <span className="text-blue-700 font-bold px-1">{formData.baseDays}</span> 天 × 
                    事假 <input name="personalLeave" value={formData.personalLeave} onChange={handleInput} className={`${inputStyle} text-rose-600 bg-white border-rose-300 shadow-sm`}/> 天 】
                    {rules.deductC !== false && <span className="text-slate-400 text-xs ml-1">+ 餐費依比例</span>}
                    <span className="font-bold text-rose-600 ml-2 text-base">= {calcResult.deductions.personalDeduction.toLocaleString()} 元</span>
                  </div>
                </div>

                <div className="flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-800 w-20 shrink-0 flex items-center"><span className="w-2 h-2 rounded-full bg-amber-400 mr-2"></span>病假扣款</span>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    【 底薪 <span className="text-blue-700 font-bold px-1">{formData.A}</span> 元 ÷ 當月 <span className="text-blue-700 font-bold px-1">{formData.baseDays}</span> 天 × 
                    病假 <input name="sickLeave" value={formData.sickLeave} onChange={handleInput} className={`${inputStyle} text-amber-600 bg-white border-amber-300 shadow-sm`}/> 天 ×
                    乘數 <span className="text-amber-600 font-bold px-1">{formData.sRate}</span> 】
                    {rules.deductC !== false && <span className="text-slate-400 text-xs ml-1">+ 餐費依比例</span>}
                    <span className="font-bold text-rose-600 ml-2 text-base">= {calcResult.deductions.sickDeduction.toLocaleString()} 元</span>
                  </div>
                </div>

                <div className="flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-800 w-20 shrink-0 flex items-center"><span className="w-2 h-2 rounded-full bg-blue-400 mr-2"></span>遲到扣款</span>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    【 底薪 <span className="text-blue-700 font-bold px-1">{formData.A}</span> 元 ÷ 當月 <span className="text-blue-700 font-bold px-1">{formData.baseDays}</span> 天 ÷
                    <span className="text-blue-700 font-bold px-1">{formData.dailyHours}</span> 小時 ÷ <span className="text-blue-700 font-bold px-1">{formData.minsPerHour}</span> 分 ×
                    ( 遲到 <input name="lateMinutes" value={formData.lateMinutes} onChange={handleInput} className={`${inputStyle} text-rose-600 bg-white border-rose-300 shadow-sm`}/> 分 - 
                    寬限 <span className="text-emerald-600 font-bold px-1">{formData.lateGraceMins}</span> 分 ) 】
                    <span className="font-bold text-rose-600 ml-2 text-base">= {calcResult.deductions.lateDeduction.toLocaleString()} 元</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={isSubmitting} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-xl transition-colors shadow-lg mt-2 text-lg flex items-center justify-center">
          {isSubmitting ? '發布中...' : `✅ 正式發布薪資單 (實發 $${calcResult.netSalary.toLocaleString()})`}
        </button>
      </form>
    </div>
  );
}

// ==========================================
// 7. 員工薪資單明細元件 
// ==========================================
function SalaryReceipt({ salary, onBack }) {
  const calc = salary.calcResult;
  const isPartTime = calc.employmentType === 'partTime';

  return (
    <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-blue-800 px-6 py-6 text-white relative">
        <button onClick={onBack} className="absolute top-6 right-6 text-blue-200 hover:text-white bg-blue-900/50 px-3 py-1.5 rounded-full text-sm transition-colors">返回列表</button>
        <h2 className="text-2xl font-bold mb-1">員工薪資明細單 {isPartTime && <span className="ml-2 text-sm bg-amber-500 text-white px-2 py-1 rounded-full">兼職</span>}</h2>
        <p className="text-blue-200">{salary.month} 結算週期</p>
        
        <div className="mt-6 flex flex-wrap gap-6 bg-blue-900/40 p-4 rounded-lg inline-flex">
          <div><span className="block text-blue-300 text-xs mb-1">姓名 / 職位</span><span className="font-medium">{salary.employeeName} / {salary.positionName}</span></div>
          <div><span className="block text-blue-300 text-xs mb-1">本期實發金額</span><span className="font-bold text-2xl text-amber-300">${salary.netSalary.toLocaleString()}</span></div>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-emerald-700 mb-4 border-b border-emerald-100 pb-2 flex items-center">
                <Plus className="w-5 h-5 mr-1" /> {isPartTime ? '出勤薪資總額' : '基本薪資總額'}
              </h3>
              <ul className="space-y-4">
                {isPartTime ? (
                  <ReceiptItem label="出勤總薪資" amount={calc.components.ptSalary} />
                ) : (
                  <>
                    <ReceiptItem label="底薪 (A)" amount={calc.components.A} />
                    <ReceiptItem label="全勤獎金 (B)" amount={calc.components.B} />
                    <ReceiptItem label="餐費補助 (C)" amount={calc.components.C} />
                    <ReceiptItem label="紅利 / 績效 (D)" amount={calc.components.D} />
                  </>
                )}
              </ul>
              <div className="mt-4 pt-4 border-t flex justify-between font-bold text-slate-800">
                <span>應發合計</span><span>${calc.grossSalary.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-600 mb-4 border-b border-slate-100 pb-2 flex items-center">
                <Landmark className="w-5 h-5 mr-1" /> 法定扣款
              </h3>
              <ul className="space-y-4">
                <ReceiptItem label="勞保自付額" amount={-calc.components.labor} isDeduction />
                <ReceiptItem label="健保自付額" amount={-calc.components.health} isDeduction />
                <ReceiptItem label="代扣勞退(自提)" amount={-calc.components.pension} isDeduction />
              </ul>
              <div className="mt-4 pt-4 border-t flex justify-between font-bold text-slate-600">
                <span>法定扣款小計</span><span>-${calc.deductions.statutoryDeduction.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-rose-700 mb-4 border-b border-rose-100 pb-2 flex items-center">
              <Trash2 className="w-4 h-4 mr-1 hidden" /> 出勤扣款明細
            </h3>
            <ul className="space-y-4">
              {isPartTime ? (
                <ReceiptItem label="遲到扣除總額" amount={-calc.deductions.lateDeduction} isDeduction />
              ) : (
                <>
                  <ReceiptItem label="事假扣除" amount={-calc.deductions.personalDeduction} isDeduction />
                  <ReceiptItem label="病假扣除" amount={-calc.deductions.sickDeduction} isDeduction />
                  <ReceiptItem label="取消全勤" amount={-calc.deductions.bDeduction} isDeduction />
                  <ReceiptItem label="紅利扣除" amount={-calc.deductions.dDeduction} isDeduction />
                  <ReceiptItem label="遲到扣款" amount={-calc.deductions.lateDeduction} isDeduction />
                </>
              )}
            </ul>
            <div className="mt-4 pt-4 border-t flex justify-between font-bold text-slate-800">
              <span>出勤扣款小計</span><span>-${calc.deductions.attendanceDeduction.toLocaleString()}</span>
            </div>
          </div>
        </div>
        
        {/* 公式透明化 */}
        <div className="mt-8 bg-blue-50/50 border border-blue-200 rounded-xl p-5">
            <h4 className="text-blue-800 font-bold mb-3 flex items-center">
              <Calculator className="w-5 h-5 mr-2" /> 本期計算公式詳解
            </h4>
            <div className="text-sm text-slate-700 space-y-2 font-mono bg-white p-4 rounded-lg border border-blue-100 shadow-sm overflow-x-auto">
              {isPartTime ? (
                <>
                  <p>基本總額：${calc.grossSalary.toLocaleString()} (出勤總額)</p>
                  {calc.deductions.lateDeduction > 0 && <p className="text-rose-600 mt-1">- 遲到扣除：遲到扣款總額 = {calc.deductions.lateDeduction.toLocaleString()} 元</p>}
                </>
              ) : (
                <>
                  <p>基本總額：${calc.grossSalary.toLocaleString()} (底薪+全勤+餐費+紅利)</p>
                  {salary.personalLeave > 0 && calc.deductions.personalDeduction > 0 && <p className="text-rose-600 mt-1 whitespace-nowrap">- 事假扣除：{[calc.rules.deductA ? `(底薪 ${calc.components.A} ÷ ${calc.rules.baseDays} × ${salary.personalLeave}天)` : null, calc.rules.deductC ? `(餐費 ${calc.components.C} ÷ ${calc.rules.baseDays} × ${salary.personalLeave}天)` : null].filter(Boolean).join(' + ')} = {calc.deductions.personalDeduction.toLocaleString()} 元</p>}
                  {salary.sickLeave > 0 && calc.deductions.sickDeduction > 0 && <p className="text-rose-600 mt-1 whitespace-nowrap">- 病假扣除：{[calc.rules.deductA ? `(底薪 ${calc.components.A} ÷ ${calc.rules.baseDays} × ${salary.sickLeave}天 × ${calc.rules.sRate})` : null, calc.rules.deductC ? `(餐費 ${calc.components.C} ÷ ${calc.rules.baseDays} × ${salary.sickLeave}天 × ${calc.rules.sRate})` : null].filter(Boolean).join(' + ')} = {calc.deductions.sickDeduction.toLocaleString()} 元</p>}
                  {calc.deductions.bDeduction > 0 && <p className="text-rose-600 mt-1 whitespace-nowrap">- 取消全勤：扣除 {calc.deductions.bDeduction.toLocaleString()} 元全勤獎金</p>}
                  {calc.deductions.dDeduction > 0 && <p className="text-rose-600 mt-1 whitespace-nowrap">- 紅利扣除：紅利 {calc.components.D} × {calc.rules.bonusPenaltyRate * 100}% = {calc.deductions.dDeduction.toLocaleString()} 元</p>}
                  
                  {calc.deductions.lateDeduction > 0 && <p className="text-rose-600 mt-1 whitespace-nowrap">- 遲到扣除：(底薪 {calc.components.A} ÷ {calc.rules.baseDays}天 ÷ {calc.rules.dailyHours}小時 ÷ {calc.rules.minsPerHour}分) × (遲到 {salary.lateMinutes} 分 - 寬限 {calc.rules.lateGraceMins} 分) = {calc.deductions.lateDeduction.toLocaleString()} 元</p>}
                  {salary.lateMinutes > 0 && calc.deductions.lateDeduction === 0 && <p className="text-emerald-600 mt-1 whitespace-nowrap">- 遲到免扣款：遲到 {salary.lateMinutes} 分鐘 (在寬限期 {calc.rules.lateGraceMins} 分鐘內)</p>}
                </>
              )}
              {calc.deductions.statutoryDeduction > 0 && (
                <p className="text-slate-500 mt-2 pt-2 border-t border-slate-100">
                  - 法定扣除：勞保 {calc.components.labor} + 健保 {calc.components.health} + 勞退 {calc.components.pension} = {calc.deductions.statutoryDeduction.toLocaleString()} 元
                </p>
              )}
              {calc.totalDeduction === 0 && <p className="text-emerald-600 mt-1 font-bold">✔️ 出勤完美，無任何扣款！</p>}

              <div className="pt-3 mt-3 border-t-2 border-dashed border-slate-200 font-bold text-blue-800 text-lg flex justify-between">
                <span>= 最終實發金額：</span><span>${calc.netSalary.toLocaleString()}</span>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptItem({ label, amount, isDeduction = false }) {
  if(amount === 0) return null; 
  return (
    <li className="flex justify-between items-center group">
      <span className="text-slate-700">{label}</span>
      <span className={`font-medium ${isDeduction ? 'text-rose-600' : 'text-slate-800'}`}>
        {amount.toLocaleString()}
      </span>
    </li>
  );
}
