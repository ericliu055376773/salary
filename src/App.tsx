import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Calculator,
  FileText,
  Info,
  Plus,
  Trash2,
  User,
  UserCheck,
  X,
  Settings,
  AlertCircle,
} from 'lucide-react';

// ==========================================
// 1. Firebase 初始化
// ==========================================
const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined') {
    return JSON.parse(__firebase_config);
  }
  return {
    apiKey: 'AIzaSyDrfYEf3wmheX-f8WTo1w6Wx8AK1Vak7Do',
    authDomain: 'salary-d6674.firebaseapp.com',
    projectId: 'salary-d6674',
    storageBucket: 'salary-d6674.firebasestorage.app',
    messagingSenderId: '549568332543',
    appId: '1:549568332543:web:2d74db9944f28222c3c2ca',
  };
};

const app = initializeApp(getFirebaseConfig());
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'demo-salary-app';

// ==========================================
// 職位薪資結構常數 (對應圖片內容)
// ==========================================
const POSITIONS = [
  { id: 'p1', name: '外場-正職', A: 29500, B: 2000, C: 3000, D: 3500 },
  { id: 'p2', name: '外場-教育員/副領班', A: 29500, B: 2000, C: 3000, D: 8500 },
  { id: 'p3', name: '外場-領班', A: 29500, B: 2000, C: 3000, D: 5500 },
  { id: 'p4', name: '經理', A: 29500, B: 2000, C: 3000, D: 10500 },
];

// ==========================================
// 2. 主應用程式元件
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('employee');
  const [salaries, setSalaries] = useState([]);
  const [rules, setRules] = useState({
    sickLeaveRate: 0.5,
    personalLeaveRate: 1.0,
    latePenalty: 100,
    strictAttendance: true,
  });

  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false); // 新增：金鑰錯誤偵測狀態
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [explanationModal, setExplanationModal] = useState({
    isOpen: false,
    title: '',
    content: '',
  });

  const [toast, setToast] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // 初始化 Auth 與檢查金鑰
  useEffect(() => {
    // 檢查是否還在使用假金鑰，如果是的話停止載入並顯示錯誤畫面
    const config = getFirebaseConfig();
    if (
      config.apiKey === 'YOUR_API_KEY' ||
      config.projectId === 'YOUR_PROJECT_ID'
    ) {
      setConfigError(true);
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== 'undefined' &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error('登入失敗:', error);
        setLoading(false); // 確保報錯時也能解除載入狀態
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 監聽薪資資料與規則設定
  useEffect(() => {
    if (!user || configError) return;

    const salariesRef = collection(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'salaries'
    );
    const unsubSalaries = onSnapshot(
      salariesRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        data.sort((a, b) => b.month.localeCompare(a.month));
        setSalaries(data);
        setLoading(false);
      },
      (error) => {
        console.error('讀取薪資失敗', error);
        setLoading(false);
      }
    );

    const rulesRef = doc(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'settings',
      'salaryRules'
    );
    const unsubRules = onSnapshot(
      rulesRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setRules(docSnap.data());
        }
      },
      (error) => console.error('讀取規則失敗', error)
    );

    return () => {
      unsubSalaries();
      unsubRules();
    };
  }, [user, configError]);

  // 渲染金鑰錯誤畫面
  if (configError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center border border-rose-100 animate-in zoom-in duration-300">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4 text-slate-800">
            請先設定 Firebase 金鑰
          </h2>
          <div className="text-slate-600 space-y-4 text-left">
            <p>
              系統偵測到您目前正在外部環境執行，且尚未填寫真實的 Firebase
              專案金鑰，因此無法連線資料庫。
            </p>
            <p className="font-bold text-slate-700 pt-2 border-t border-slate-100">
              🛠️ 解決步驟：
            </p>
            <ol className="list-decimal list-inside space-y-3 text-sm bg-slate-50 p-5 rounded-xl border border-slate-200">
              <li>
                前往{' '}
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:text-blue-800 font-semibold underline"
                >
                  Firebase Console
                </a>{' '}
                建立一個免費專案。
              </li>
              <li>
                在左側選單啟用 <strong>Firestore Database</strong> 與{' '}
                <strong>Authentication (選擇匿名登入)</strong>。
              </li>
              <li>取得網頁版設定檔 (齒輪圖示 {'>'} 專案設定)。</li>
              <li>
                回到程式碼 <strong>第 15 行</strong>，將{' '}
                <code>YOUR_API_KEY</code>{' '}
                等假資訊替換為您的真實金鑰，網頁就會自動載入成功！
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        系統載入中...
      </div>
    );

  const displaySalaries =
    role === 'admin'
      ? salaries
      : salaries.filter((s) => s.employeeId === user?.uid);

  const openExplanation = (title, content) => {
    setExplanationModal({ isOpen: true, title, content });
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-12">
      {/* 頂部導航列 */}
      <nav className="bg-blue-800 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Calculator className="h-6 w-6 text-blue-300" />
            <span className="text-xl font-bold tracking-wider">
              透明薪資系統
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-blue-900 rounded-full p-1 flex items-center">
              <button
                onClick={() => {
                  setRole('employee');
                  setSelectedSalary(null);
                }}
                className={`px-3 py-1 text-sm rounded-full transition-colors flex items-center ${
                  role === 'employee'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-blue-300 hover:text-white'
                }`}
              >
                <User size={14} className="mr-1" /> 員工自助區
              </button>
              <button
                onClick={() => {
                  setRole('admin');
                  setSelectedSalary(null);
                }}
                className={`px-3 py-1 text-sm rounded-full transition-colors flex items-center ${
                  role === 'admin'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-blue-300 hover:text-white'
                }`}
              >
                <Settings size={14} className="mr-1" /> 人資後台
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {selectedSalary ? (
          <SalaryReceipt
            salary={selectedSalary}
            onBack={() => setSelectedSalary(null)}
            openExplanation={openExplanation}
          />
        ) : (
          <div className="space-y-8">
            {/* 根據角色顯示不同的上半部區塊 */}
            {role === 'admin' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <AdminRulesForm rules={rules} showToast={showToast} />
                </div>
                <div className="lg:col-span-2">
                  <AdminPublishForm
                    user={user}
                    rules={rules}
                    showToast={showToast}
                  />
                </div>
              </div>
            ) : (
              <EmployeeEstimator rules={rules} />
            )}

            {/* 下半部：歷史紀錄列表 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-600" />
                  {role === 'admin' ? '所有員工薪資紀錄' : '我的正式薪資紀錄'}
                </h2>
              </div>

              {displaySalaries.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  目前沒有任何薪資紀錄。
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                        <th className="p-4 font-medium">計薪月份</th>
                        <th className="p-4 font-medium">職位</th>
                        {role === 'admin' && (
                          <th className="p-4 font-medium">員工姓名</th>
                        )}
                        <th className="p-4 font-medium text-right">實發金額</th>
                        <th className="p-4 font-medium text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displaySalaries.map((s) => (
                        <tr
                          key={s.id}
                          className="hover:bg-blue-50/50 transition-colors"
                        >
                          <td className="p-4 font-medium text-slate-800">
                            {s.month}
                          </td>
                          <td className="p-4 text-slate-600">
                            {s.positionName}
                          </td>
                          {role === 'admin' && (
                            <td className="p-4 text-slate-600">
                              {s.employeeName}
                            </td>
                          )}
                          <td className="p-4 text-right font-bold text-blue-700">
                            ${s.netSalary.toLocaleString()}
                          </td>
                          <td className="p-4 text-center space-x-2">
                            <button
                              onClick={() => setSelectedSalary(s)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 px-3 py-1 rounded-md text-sm transition-colors"
                            >
                              查看明細
                            </button>
                            {role === 'admin' && (
                              <button
                                onClick={() => {
                                  setConfirmDialog({
                                    message:
                                      '確定要刪除這筆紀錄嗎？此動作無法復原。',
                                    onConfirm: async () => {
                                      try {
                                        await deleteDoc(
                                          doc(
                                            db,
                                            'artifacts',
                                            appId,
                                            'public',
                                            'data',
                                            'salaries',
                                            s.id
                                          )
                                        );
                                        showToast('資料已成功刪除');
                                      } catch (e) {
                                        showToast('刪除失敗，請稍後再試');
                                      }
                                    },
                                  });
                                }}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors"
                              >
                                刪除
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 公式解釋彈出視窗 */}
      {explanationModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-blue-50 px-6 py-4 flex justify-between items-center border-b border-blue-100">
              <h3 className="font-bold text-blue-800 flex items-center">
                <Info className="w-5 h-5 mr-2 text-blue-600" />
                {explanationModal.title} 計算說明
              </h3>
              <button
                onClick={() =>
                  setExplanationModal({ isOpen: false, title: '', content: '' })
                }
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 text-slate-700 leading-relaxed whitespace-pre-line">
              {explanationModal.content}
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示通知 */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-3 rounded-lg shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}

      {/* 確認刪除對話框 */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-rose-500" />
              系統確認
            </h3>
            <p className="text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
              >
                取消
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium shadow-sm"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. 共用薪資計算邏輯核心 (同時供試算與發布使用)
// ==========================================
const calculateSalaryCore = (position, inputs, currentRules) => {
  const { A, B, C, D } = position;
  const { personalLeave, sickLeave, lateTimes } = inputs;

  // 1. 計算日薪基準 (通常依勞基法，經常性給予的底薪+餐費納入計算基準)
  const dailyBase = Math.round((A + C) / 30);

  // 2. 扣除項目計算
  const personalDeduction = Math.round(
    dailyBase * currentRules.personalLeaveRate * personalLeave
  );
  const sickDeduction = Math.round(
    dailyBase * currentRules.sickLeaveRate * sickLeave
  );
  const lateDeduction = currentRules.latePenalty * lateTimes;

  // 3. 全勤獎金判定
  let earnedB = B;
  if (
    currentRules.strictAttendance &&
    (personalLeave > 0 || sickLeave > 0 || lateTimes > 0)
  ) {
    earnedB = 0; // 只要有請假或遲到即取消全勤
  }

  // 4. 總發放與實發
  const grossSalary = A + earnedB + C + D;
  const totalDeduction = personalDeduction + sickDeduction + lateDeduction;
  const netSalary = grossSalary - totalDeduction;

  return {
    components: { A, B: earnedB, originalB: B, C, D },
    deductions: { personalDeduction, sickDeduction, lateDeduction, dailyBase },
    grossSalary,
    totalDeduction,
    netSalary,
  };
};

// ==========================================
// 4. 員工自助試算器元件
// ==========================================
function EmployeeEstimator({ rules }) {
  const [inputs, setInputs] = useState({
    positionId: 'p1',
    personalLeave: 0,
    sickLeave: 0,
    lateTimes: 0,
  });

  const handleInput = (e) =>
    setInputs({
      ...inputs,
      [e.target.name]:
        Number(e.target.value) ||
        (e.target.name === 'positionId' ? e.target.value : 0),
    });

  const position = POSITIONS.find((p) => p.id === inputs.positionId);
  const result = calculateSalaryCore(position, inputs, rules);

  return (
    <div className="bg-white rounded-xl shadow-md border border-blue-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-800 flex justify-between items-center text-white">
        <h2 className="text-lg font-bold flex items-center">
          <Calculator className="w-5 h-5 mr-2" /> 員工專屬 - 當月薪資試算器
        </h2>
      </div>
      <div className="p-6">
        <p className="text-sm text-slate-500 mb-6 flex items-start bg-blue-50 p-3 rounded-lg border border-blue-100">
          <Info className="w-5 h-5 mr-2 text-blue-500 flex-shrink-0" />
          在此輸入您本月的請假與出勤狀況，系統將自動套用人資設定的最新規則，預估您的實領薪水。（僅供試算，實際依人資發布為準）
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              我的職位
            </label>
            <select
              name="positionId"
              value={inputs.positionId}
              onChange={(e) =>
                setInputs({ ...inputs, positionId: e.target.value })
              }
              className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-2 bg-white"
            >
              {POSITIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              事假 (天)
            </label>
            <input
              type="number"
              name="personalLeave"
              value={inputs.personalLeave}
              onChange={handleInput}
              min="0"
              className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 border p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              病假 (天)
            </label>
            <input
              type="number"
              name="sickLeave"
              value={inputs.sickLeave}
              onChange={handleInput}
              min="0"
              className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 border p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              遲到 (次)
            </label>
            <input
              type="number"
              name="lateTimes"
              value={inputs.lateTimes}
              onChange={handleInput}
              min="0"
              className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 border p-2"
            />
          </div>
        </div>

        {/* 試算結果呈現 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-bl-lg">
            試算結果
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-slate-700 font-bold mb-3 border-b pb-2">
                本月結構試算
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between text-slate-600">
                  <span>底薪 (A)</span>{' '}
                  <span>${result.components.A.toLocaleString()}</span>
                </li>
                <li className="flex justify-between text-slate-600">
                  <span className="flex items-center">
                    全勤 (B)
                    {inputs.personalLeave > 0 ||
                    inputs.sickLeave > 0 ||
                    inputs.lateTimes > 0 ? (
                      <span className="ml-2 text-xs text-rose-500 bg-rose-50 px-1 rounded border border-rose-200">
                        因缺勤取消
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={
                      result.components.B === 0
                        ? 'text-rose-500 line-through'
                        : ''
                    }
                  >
                    ${result.components.originalB.toLocaleString()}
                  </span>
                </li>
                <li className="flex justify-between text-slate-600">
                  <span>餐費 (C)</span>{' '}
                  <span>${result.components.C.toLocaleString()}</span>
                </li>
                <li className="flex justify-between text-slate-600">
                  <span>紅利 (D)</span>{' '}
                  <span>${result.components.D.toLocaleString()}</span>
                </li>
              </ul>
              <div className="mt-2 pt-2 border-t flex justify-between font-bold text-slate-800">
                <span>應發合計</span>
                <span>${result.grossSalary.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <h4 className="text-slate-700 font-bold mb-3 border-b pb-2">
                扣款試算
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between text-rose-600">
                  <span>事假扣款 ({inputs.personalLeave}天)</span>{' '}
                  <span>
                    -${result.deductions.personalDeduction.toLocaleString()}
                  </span>
                </li>
                <li className="flex justify-between text-rose-600">
                  <span>病假扣款 ({inputs.sickLeave}天)</span>{' '}
                  <span>
                    -${result.deductions.sickDeduction.toLocaleString()}
                  </span>
                </li>
                <li className="flex justify-between text-rose-600">
                  <span>遲到扣款 ({inputs.lateTimes}次)</span>{' '}
                  <span>
                    -${result.deductions.lateDeduction.toLocaleString()}
                  </span>
                </li>
              </ul>
              <div className="mt-2 pt-2 border-t flex justify-between font-bold text-rose-700">
                <span>扣款合計</span>
                <span>-${result.totalDeduction.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white border border-blue-100 rounded-lg p-4 text-center shadow-sm">
            <span className="text-slate-500 text-sm">預估實發薪資</span>
            <div className="text-3xl font-black text-blue-700 mt-1">
              ${result.netSalary.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 5. 人資後台設定規則元件
// ==========================================
function AdminRulesForm({ rules, showToast }) {
  const [localRules, setLocalRules] = useState(rules);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalRules(rules);
  }, [rules]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(
          db,
          'artifacts',
          appId,
          'public',
          'data',
          'settings',
          'salaryRules'
        ),
        localRules
      );
      showToast('計薪規則已更新！員工的試算器已同步。');
    } catch (e) {
      showToast('更新失敗，請確認連線。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden h-full">
      <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-center">
        <Settings className="w-5 h-5 mr-2 text-amber-700" />
        <h2 className="text-lg font-bold text-amber-800">全域扣薪規則設定</h2>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            事假扣薪比例 (乘數)
          </label>
          <input
            type="number"
            step="0.1"
            value={localRules.personalLeaveRate}
            onChange={(e) =>
              setLocalRules({
                ...localRules,
                personalLeaveRate: Number(e.target.value),
              })
            }
            className="w-full border-slate-300 rounded-md border p-2"
          />
          <p className="text-xs text-slate-400 mt-1">
            預設 1.0 (扣除當日全額薪水)
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            病假扣薪比例 (乘數)
          </label>
          <input
            type="number"
            step="0.1"
            value={localRules.sickLeaveRate}
            onChange={(e) =>
              setLocalRules({
                ...localRules,
                sickLeaveRate: Number(e.target.value),
              })
            }
            className="w-full border-slate-300 rounded-md border p-2"
          />
          <p className="text-xs text-slate-400 mt-1">
            預設 0.5 (法規規定扣半薪)
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            遲到單次扣款 (元)
          </label>
          <input
            type="number"
            value={localRules.latePenalty}
            onChange={(e) =>
              setLocalRules({
                ...localRules,
                latePenalty: Number(e.target.value),
              })
            }
            className="w-full border-slate-300 rounded-md border p-2"
          />
        </div>
        <div className="flex items-center pt-2">
          <input
            type="checkbox"
            id="strict"
            checked={localRules.strictAttendance}
            onChange={(e) =>
              setLocalRules({
                ...localRules,
                strictAttendance: e.target.checked,
              })
            }
            className="h-4 w-4 text-amber-600 rounded border-gray-300"
          />
          <label htmlFor="strict" className="ml-2 block text-sm text-slate-700">
            任何請假/遲到即取消全勤
          </label>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-md transition-colors font-medium"
        >
          {saving ? '儲存中...' : '套用新規則'}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 6. 人資發布薪資表單
// ==========================================
function AdminPublishForm({ user, rules, showToast }) {
  const [formData, setFormData] = useState({
    month: new Date().toISOString().slice(0, 7),
    employeeName: '王小明',
    positionId: 'p1',
    personalLeave: 0,
    sickLeave: 0,
    lateTimes: 0,
    customD: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const position = POSITIONS.find((p) => p.id === formData.positionId);
      const actualPosition = { ...position, D: formData.customD || position.D };
      const calcResult = calculateSalaryCore(actualPosition, formData, rules);

      const finalData = {
        ...formData,
        positionName: position.name,
        employeeId: user.uid,
        rulesSnapshot: rules,
        calcResult,
        netSalary: calcResult.netSalary,
        createdAt: serverTimestamp(),
      };

      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', 'salaries'),
        finalData
      );
      showToast('薪資單正式發布成功！');
    } catch (error) {
      showToast('發布失敗，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center">
        <Plus className="w-5 h-5 mr-2 text-slate-600" />
        <h2 className="text-lg font-bold text-slate-800">正式發布薪資單</h2>
      </div>
      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-slate-700 mb-1">月份</label>
            <input
              type="month"
              value={formData.month}
              onChange={(e) =>
                setFormData({ ...formData, month: e.target.value })
              }
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">
              員工姓名
            </label>
            <input
              type="text"
              value={formData.employeeName}
              onChange={(e) =>
                setFormData({ ...formData, employeeName: e.target.value })
              }
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">
              職位設定
            </label>
            <select
              value={formData.positionId}
              onChange={(e) =>
                setFormData({ ...formData, positionId: e.target.value })
              }
              className="w-full border p-2 rounded bg-white"
            >
              {POSITIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-sm text-slate-700 mb-1">
              事假(天)
            </label>
            <input
              type="number"
              value={formData.personalLeave}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  personalLeave: Number(e.target.value),
                })
              }
              className="w-full border p-2 rounded"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">
              病假(天)
            </label>
            <input
              type="number"
              value={formData.sickLeave}
              onChange={(e) =>
                setFormData({ ...formData, sickLeave: Number(e.target.value) })
              }
              className="w-full border p-2 rounded"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">
              遲到(次)
            </label>
            <input
              type="number"
              value={formData.lateTimes}
              onChange={(e) =>
                setFormData({ ...formData, lateTimes: Number(e.target.value) })
              }
              className="w-full border p-2 rounded"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">
              調整紅利 D (選填)
            </label>
            <input
              type="number"
              placeholder="預設"
              value={formData.customD || ''}
              onChange={(e) =>
                setFormData({ ...formData, customD: Number(e.target.value) })
              }
              className="w-full border p-2 rounded border-blue-300 bg-blue-50"
              min="0"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-3 rounded-lg transition-colors"
        >
          發布薪資單給員工
        </button>
      </form>
    </div>
  );
}

// ==========================================
// 7. 員工薪資單明細元件 (解釋的核心)
// ==========================================
function SalaryReceipt({ salary, onBack, openExplanation }) {
  const rules = salary.rulesSnapshot;
  const calc = salary.calcResult;

  return (
    <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden border border-slate-200">
      <div className="bg-blue-800 px-6 py-6 text-white relative">
        <button
          onClick={onBack}
          className="absolute top-6 right-6 text-blue-200 hover:text-white bg-blue-900/50 px-3 py-1.5 rounded-full text-sm"
        >
          返回列表
        </button>
        <h2 className="text-2xl font-bold mb-1">員工薪資明細單</h2>
        <p className="text-blue-200">{salary.month} 結算週期</p>

        <div className="mt-6 flex flex-wrap gap-6 bg-blue-900/40 p-4 rounded-lg inline-flex">
          <div>
            <span className="block text-blue-300 text-xs mb-1">
              姓名 / 職位
            </span>
            <span className="font-medium">
              {salary.employeeName} / {salary.positionName}
            </span>
          </div>
          <div>
            <span className="block text-blue-300 text-xs mb-1">
              本期實發金額
            </span>
            <span className="font-bold text-2xl text-amber-300">
              ${salary.netSalary.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <p className="text-sm text-slate-500 mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start">
          <Info className="w-5 h-5 mr-2 text-blue-500 flex-shrink-0" />
          點擊各項目旁邊的 (i)
          圖示，系統會詳細為您解釋這筆金額在發布當時的「計算公式與扣款規則」。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 應發項目 */}
          <div>
            <h3 className="text-lg font-bold text-emerald-700 mb-4 border-b border-emerald-100 pb-2 flex items-center">
              <Plus className="w-5 h-5 mr-1" /> 應發項目
            </h3>
            <ul className="space-y-4">
              <ReceiptItem
                label="底薪 (A)"
                amount={calc.components.A}
                onInfo={() =>
                  openExplanation(
                    '底薪 (A)',
                    '依據職位設定之基本月薪，此金額為請假扣款的換算基準之一。'
                  )
                }
              />
              <ReceiptItem
                label="全勤獎金 (B)"
                amount={calc.components.B}
                onInfo={() =>
                  openExplanation(
                    '全勤獎金 (B)',
                    `標準金額：$${calc.components.originalB}\n\n當期規則：${
                      rules.strictAttendance
                        ? '只要有任何事假、病假或遲到紀錄，即全額取消全勤。'
                        : '未設定嚴格扣除條件。'
                    }\n\n您的出勤狀況：\n事假 ${salary.personalLeave}天, 病假 ${
                      salary.sickLeave
                    }天, 遲到 ${salary.lateTimes}次\n\n判定結果：${
                      calc.components.B === 0
                        ? '因上述缺勤紀錄，本期全勤取消。'
                        : '全勤達成，發放全額！'
                    }`
                  )
                }
              />
              <ReceiptItem
                label="餐費補助 (C)"
                amount={calc.components.C}
                onInfo={() =>
                  openExplanation(
                    '餐費補助 (C)',
                    '公司提供之固定餐飲津貼。此項目與底薪合併作為日薪換算之基礎。'
                  )
                }
              />
              <ReceiptItem
                label="紅利 / 績效 (D)"
                amount={calc.components.D}
                onInfo={() =>
                  openExplanation(
                    '紅利 / 績效 (D)',
                    '依據當月營運狀況、職位級距或個人績效發放之變動獎金。'
                  )
                }
              />
            </ul>
            <div className="mt-4 pt-4 border-t flex justify-between font-bold text-slate-800">
              <span>應發合計</span>
              <span>${calc.grossSalary.toLocaleString()}</span>
            </div>
          </div>

          {/* 應扣項目 */}
          <div>
            <h3 className="text-lg font-bold text-rose-700 mb-4 border-b border-rose-100 pb-2 flex items-center">
              <Trash2 className="w-4 h-4 mr-1 hidden" /> 應扣項目 (請假與遲到)
            </h3>
            <ul className="space-y-4">
              <ReceiptItem
                label={`事假扣款 (${salary.personalLeave}天)`}
                amount={-calc.deductions.personalDeduction}
                isDeduction
                onInfo={() =>
                  openExplanation(
                    '事假扣款',
                    `日薪計算基準：(底薪A + 餐費C) ÷ 30天\n= (${
                      calc.components.A
                    } + ${calc.components.C}) ÷ 30 = 約 ${
                      calc.deductions.dailyBase
                    } 元/天\n\n事假扣款率：${
                      rules.personalLeaveRate * 100
                    }%\n\n計算公式：\n日薪 ${calc.deductions.dailyBase} × ${
                      salary.personalLeave
                    } 天 × ${rules.personalLeaveRate} = ${
                      calc.deductions.personalDeduction
                    } 元`
                  )
                }
              />
              <ReceiptItem
                label={`病假扣款 (${salary.sickLeave}天)`}
                amount={-calc.deductions.sickDeduction}
                isDeduction
                onInfo={() =>
                  openExplanation(
                    '病假扣款',
                    `日薪計算基準：約 ${
                      calc.deductions.dailyBase
                    } 元/天\n\n病假扣款率：${
                      rules.sickLeaveRate * 100
                    }% (法規為半薪)\n\n計算公式：\n日薪 ${
                      calc.deductions.dailyBase
                    } × ${salary.sickLeave} 天 × ${rules.sickLeaveRate} = ${
                      calc.deductions.sickDeduction
                    } 元`
                  )
                }
              />
              <ReceiptItem
                label={`遲到扣款 (${salary.lateTimes}次)`}
                amount={-calc.deductions.lateDeduction}
                isDeduction
                onInfo={() =>
                  openExplanation(
                    '遲到扣款',
                    `當期扣款規則：遲到一次扣除 ${rules.latePenalty} 元。\n\n計算公式：\n${rules.latePenalty} 元 × 遲到 ${salary.lateTimes} 次 = ${calc.deductions.lateDeduction} 元`
                  )
                }
              />
            </ul>
            <div className="mt-4 pt-4 border-t flex justify-between font-bold text-slate-800">
              <span>扣款合計</span>
              <span>-${calc.totalDeduction.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
          <p className="text-slate-500 text-sm mb-2">
            本期實發金額 (應發合計 - 扣款合計)
          </p>
          <p className="text-4xl font-black text-blue-800 tracking-tight">
            NT$ {salary.netSalary.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function ReceiptItem({ label, amount, isDeduction = false, onInfo }) {
  return (
    <li className="flex justify-between items-center group">
      <div className="flex items-center">
        <span className="text-slate-700">{label}</span>
        <button
          onClick={onInfo}
          className="ml-2 text-slate-300 hover:text-blue-500 transition-colors"
          title="查看計算方式"
        >
          <Info size={16} />
        </button>
      </div>
      <span
        className={`font-medium ${
          isDeduction && amount !== 0 ? 'text-rose-600' : 'text-slate-800'
        }`}
      >
        {amount.toLocaleString()}
      </span>
    </li>
  );
}
