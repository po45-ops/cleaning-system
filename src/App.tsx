import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  CheckCircle,
  FileSpreadsheet,
  Printer,
  Clock,
  XCircle,
  AlertCircle,
  Upload,
  FileText,
  UserCheck,
  Users,
  CalendarDays,
  BarChart3,
  LogOut,
  Key,
  Shield,
  Lock,
  Trash2,
  UserPlus,
  Edit,
} from "lucide-react";

// === URL ฐานข้อมูล Google Sheets ของคุณ ===
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyTSx3ggaJfXtYd_rQ67FoI5pPb8y_LXcTAm6RiSnkf34uiZL5GZBStGVMXyGCHQ5JfEA/exec";

// --- ข้อมูลพื้นฐาน ---
const ZONES = [
  {
    id: 1,
    name: "เขต 1",
    class: "ป.1",
    fullClass: "ชั้นประถมศึกษาปีที่ 1",
    desc: "รอบอาคารเรียนของ ป.1, ป.6 และ ม.1 ทางเดินลงไปอาคารอเนกประสงค์ (หน้าห้อง ป.1)",
  },
  {
    id: 2,
    name: "เขต 2",
    class: "ป.2",
    fullClass: "ชั้นประถมศึกษาปีที่ 2",
    desc: "รอบอาคาร ป.2, ป.3 รวมถึงบริเวณทางเดินถึงสหกรณ์ และโรงจอดรถข้างสหกรณ์",
  },
  {
    id: 3,
    name: "เขต 3",
    class: "ป.3",
    fullClass: "ชั้นประถมศึกษาปีที่ 3",
    desc: "ถนนทางเข้าโรงเรียน ต่อเนื่องจนถึงก่อนบริเวณโรงจอดรถหน้าโรงอาหาร",
  },
  {
    id: 4,
    name: "เขต 4",
    class: "ป.4",
    fullClass: "ชั้นประถมศึกษาปีที่ 4",
    desc: "หน้าอาคารห้องวิชาการ, ห้องคณิตศาสตร์ (ครูพงศกร), ห้อง ป.4 (บริเวณสนามหญ้าและจุดเช็คอิน)",
  },
  {
    id: 5,
    name: "เขต 5",
    class: "ป.5",
    fullClass: "ชั้นประถมศึกษาปีที่ 5",
    desc: "สนามหญ้าโรงเรียน, อาคารอเนกประสงค์ และห้องน้ำข้างห้อง ม.1",
  },
  {
    id: 6,
    name: "เขต 6",
    class: "ป.6",
    fullClass: "ชั้นประถมศึกษาปีที่ 6",
    desc: "สนามวอลเลย์บอลหน้าเสาธง, รอบอาคาร USO Net และศาลาพัก ข้างสนามวอลเลย์บอล ทางเดินลงอาคารอเนกประสงค์ (หน้าห้อง ม.3)",
  },
  {
    id: 7,
    name: "เขต 7",
    class: "ม.1",
    fullClass: "ชั้นมัธยมศึกษาปีที่ 1",
    desc: "โรงซักล้าง, โรงอาหาร, ที่จอดรถหน้าโรงอาหาร และห้องน้ำลอยฟ้า",
  },
  {
    id: 8,
    name: "เขต 8",
    class: "ม.2",
    fullClass: "ชั้นมัธยมศึกษาปีที่ 2",
    desc: "หลังอาคารห้องวิชาการ, ห้องคณิตศาสตร์ (ครูพงศกร), ห้อง ป.4 และบริเวณอาคารห้องครูไอวาลิญ, ห้อง ม.2 และห้องครูนิรุจน์",
  },
  {
    id: 9,
    name: "เขต 9",
    class: "ม.3",
    fullClass: "ชั้นมัธยมศึกษาปีที่ 3",
    desc: "รอบอาคาร ป.5, อาคาร ม.3, ห้องน้ำ ป.1 และห้องน้ำหลังห้อง ม.3",
  },
];

const RUBRIC = [
  {
    score: 3,
    label: "ดีมาก",
    color: "bg-green-100 border-green-500 text-green-700",
    desc: "พื้นสะอาดไม่มีขยะ/ฝุ่น, ถังขยะถูกเท, อุปกรณ์เป็นระเบียบ, นักเรียนมาครบ",
  },
  {
    score: 2,
    label: "พอใช้",
    color: "bg-blue-100 border-blue-500 text-blue-700",
    desc: "พื้นสะอาดแต่มีฝุ่นเล็กน้อย, อุปกรณ์ไม่เป็นระเบียบเล็กน้อย, ขาดบางคน",
  },
  {
    score: 1,
    label: "ปรับปรุง",
    color: "bg-yellow-100 border-yellow-500 text-yellow-700",
    desc: "พื้นสกปรก มีขยะ, ไม่เทถังขยะ, อุปกรณ์กระจัดกระจาย, มาทำเวรน้อย",
  },
  {
    score: 0,
    label: "ไม่ผ่าน",
    color: "bg-red-100 border-red-500 text-red-700",
    desc: "ไม่มีการทำความสะอาดเลย หรือไม่มีนักเรียนมาปฏิบัติหน้าที่",
  },
];

const getDefaultWeekday = () => {
  const d = new Date();
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() - 1);
  if (day === 0) d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatThaiDateShort = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const months = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
};

// 🚀 ฟังก์ชันเสริมเพื่อเคลียร์ Timezone และแปลงวันที่ใน Sheet ให้เป็น YYYY-MM-DD เป๊ะๆ
const formatDateKey = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getInspectionStatusPriority = (status) => {
  if (status === "approved") return 3;
  if (status === "pending") return 2;
  if (status === "rejected") return 1;
  return 0;
};

const pickPreferredInspection = (current, candidate) => {
  if (!current) return candidate;

  const currentPriority = getInspectionStatusPriority(current.status);
  const candidatePriority = getInspectionStatusPriority(candidate.status);
  if (candidatePriority !== currentPriority) {
    return candidatePriority > currentPriority ? candidate : current;
  }

  const currentId = Number(current.id) || 0;
  const candidateId = Number(candidate.id) || 0;
  return candidateId >= currentId ? candidate : current;
};

// ป้องกันข้อมูลซ้ำทั้งกรณี ID ซ้ำ และกรณีเขตเดิมถูกส่งซ้ำในวันเดียวกัน
const deduplicateInspections = (items) => {
  const recordsById = new Map();

  items.forEach((item, index) => {
    const id = String(item.id || "").trim();
    const key = id ? `id:${id}` : `row:${index}`;
    recordsById.set(
      key,
      pickPreferredInspection(recordsById.get(key), item)
    );
  });

  const recordsByDateAndZone = new Map();
  Array.from(recordsById.values()).forEach((item, index) => {
    const date = formatDateKey(item.date);
    const zoneId = Number(item.zoneId);
    const key = date && zoneId ? `${date}|${zoneId}` : `record:${index}`;
    recordsByDateAndZone.set(
      key,
      pickPreferredInspection(recordsByDateAndZone.get(key), item)
    );
  });

  return Array.from(recordsByDateAndZone.values());
};

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.6);
        resolve(compressedDataUrl);
      };
    };
  });
};

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("cleaning_auth_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState("student");
  const [inspections, setInspections] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem("cleaning_auth_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("cleaning_auth_user");
      setActiveTab("student");
    }
  }, [user]);

  const [schoolLogo, setSchoolLogo] = useState(() => {
    return localStorage.getItem("cleaning_school_logo") || "";
  });

  useEffect(() => {
    localStorage.setItem("cleaning_school_logo", schoolLogo);
  }, [schoolLogo]);

  const [studentCredentials, setStudentCredentials] = useState(() => {
    const saved = localStorage.getItem("cleaning_student_creds");
    return saved ? JSON.parse(saved) : [{ id: "สภา01", password: "1234" }];
  });

  useEffect(() => {
    localStorage.setItem(
      "cleaning_student_creds",
      JSON.stringify(studentCredentials)
    );
  }, [studentCredentials]);

  const fetchFromSheets = async () => {
    if (!user) return;
    setIsLoadingData(true);
    try {
      const res = await fetch(`${SCRIPT_URL}?refresh=${Date.now()}`);
      const json = await res.json();
      if (json.status === "success") {
        const uniqueInspections = deduplicateInspections(
          Array.isArray(json.data) ? json.data : []
        );
        setInspections(uniqueInspections.reverse());
      }
    } catch (err) {
      console.error("โหลดข้อมูลล้มเหลว:", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchFromSheets();
  }, [user]);

  const deleteInspection = async (id) => {
    if (
      !window.confirm(
        "คุณแน่ใจหรือไม่ที่จะลบรายการนี้อย่างถาวรออกจากฐานข้อมูล?"
      )
    )
      return false;
    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "delete", id }),
      });
      const json = await response.json();
      if (json.status === "success") {
        alert("ลบข้อมูลสำเร็จ!");
        setInspections(inspections.filter((item) => item.id !== id));
        return true;
      } else {
        alert("เกิดข้อผิดพลาด: " + json.message);
        return false;
      }
    } catch (e) {
      alert("เชื่อมต่อฐานข้อมูลเพื่อลบล้มเหลว");
      return false;
    }
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const confirmLogout = () => {
    setUser(null);
    setShowLogoutConfirm(false);
  };

  if (!user) {
    return (
      <LoginScreen
        onLogin={setUser}
        schoolLogo={schoolLogo}
        studentCredentials={studentCredentials}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 md:pb-0 print:bg-white print:pb-0">
      <header className="bg-emerald-600 text-white p-3 md:p-4 shadow-md print:hidden sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-full w-11 h-11 md:w-12 md:h-12 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
              {schoolLogo ? (
                <img
                  src={schoolLogo}
                  alt="School Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Camera className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
              )}
            </div>
            <div>
              <h1 className="text-base md:text-xl font-bold leading-tight drop-shadow-sm">
                ระบบตรวจเวรทำความสะอาด
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <p className="text-emerald-100 text-xs md:text-sm">
                  โรงเรียนไตรธารวิทยา
                </p>
                <span className="bg-emerald-800/80 text-emerald-50 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/50 whitespace-nowrap shadow-sm">
                  {user.role === "admin"
                    ? "โหมดครู/แอดมิน"
                    : `สภานักเรียน: ${user.id}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex bg-emerald-700/40 p-1 rounded-xl items-center gap-1 border border-emerald-500/30">
              <button
                onClick={() => setActiveTab("student")}
                className={`px-3 py-2 flex items-center gap-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "student"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-emerald-50 hover:bg-emerald-600/60"
                }`}
              >
                <Users className="w-4 h-4" /> บันทึกผล
              </button>

              <button
                onClick={() => setActiveTab("teacher")}
                className={`px-3 py-2 flex items-center gap-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "teacher"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-emerald-50 hover:bg-emerald-600/60"
                }`}
              >
                <UserCheck className="w-4 h-4" />{" "}
                {user.role === "admin" ? "ตรวจอนุมัติ" : "สถานะงาน"}
              </button>

              <button
                onClick={() => setActiveTab("calendar")}
                className={`px-3 py-2 flex items-center gap-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "calendar"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-emerald-50 hover:bg-emerald-600/60"
                }`}
              >
                <CalendarDays className="w-4 h-4" /> ปฏิทิน
              </button>

              {user.role === "admin" && (
                <>
                  <button
                    onClick={() => setActiveTab("report")}
                    className={`px-3 py-2 flex items-center gap-2 rounded-lg text-sm font-bold transition-all ${
                      activeTab === "report"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-emerald-50 hover:bg-emerald-600/60"
                    }`}
                  >
                    <FileText className="w-4 h-4" /> รายงาน
                  </button>
                  <button
                    onClick={() => setActiveTab("users")}
                    className={`px-3 py-2 flex items-center gap-2 rounded-lg text-sm font-bold transition-all ${
                      activeTab === "users"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-emerald-50 hover:bg-emerald-600/60"
                    }`}
                  >
                    <Key className="w-4 h-4" /> รหัสผ่าน
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="bg-emerald-700 hover:bg-red-500 text-white p-2 md:px-4 md:py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-bold border border-emerald-600 hover:border-red-500 shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 mt-2">
        {isLoadingData ? (
          <div className="py-20 text-center text-slate-500 font-bold flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
            กำลังดึงข้อมูลล่าสุดจาก Google Sheets...
          </div>
        ) : (
          <>
            {activeTab === "student" && (
              <StudentForm
                inspections={inspections}
                onSave={(data) =>
                  setInspections(
                    deduplicateInspections([data, ...inspections])
                  )
                }
              />
            )}
            {activeTab === "teacher" && (
              <TeacherApproval
                inspections={inspections}
                deleteInspection={deleteInspection}
                userRole={user.role}
                updateStatus={async (id, status) => {
                  try {
                    const item = inspections.find((i) => i.id === id);
                    const payload = {
                      action: "update",
                      id,
                      score: item.score,
                      notes: item.notes,
                      status,
                      date: item.date,
                    };
                    const res = await fetch(SCRIPT_URL, {
                      method: "POST",
                      body: JSON.stringify(payload),
                    });
                    const json = await res.json();
                    if (json.status === "success") {
                      setInspections(
                        inspections.map((item) =>
                          item.id === id ? { ...item, status } : item
                        )
                      );
                      await fetchFromSheets();
                      return true;
                    } else {
                      alert("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: " + json.message);
                      return false;
                    }
                  } catch (e) {
                    alert("เชื่อมต่อฐานข้อมูลล้มเหลว");
                    return false;
                  }
                }}
                updateInspection={async (updatedItem) => {
                  try {
                    const payload = {
                      action: "update",
                      id: updatedItem.id,
                      score: updatedItem.score,
                      notes: updatedItem.notes,
                      status: updatedItem.status,
                      date: updatedItem.date,
                    };
                    const res = await fetch(SCRIPT_URL, {
                      method: "POST",
                      body: JSON.stringify(payload),
                    });
                    const json = await res.json();
                    if (json.status === "success") {
                      setInspections(
                        inspections.map((item) =>
                          item.id === updatedItem.id ? updatedItem : item
                        )
                      );
                      return true;
                    } else {
                      alert("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: " + json.message);
                      return false;
                    }
                  } catch (e) {
                    alert("เชื่อมต่อฐานข้อมูลล้มเหลว");
                    return false;
                  }
                }}
              />
            )}
            {activeTab === "calendar" && (
              <InspectionCalendar inspections={inspections} />
            )}
            {user.role === "admin" && activeTab === "report" && (
              <ReportView
                inspections={inspections}
                schoolLogo={schoolLogo}
                setSchoolLogo={setSchoolLogo}
              />
            )}
            {user.role === "admin" && activeTab === "users" && (
              <UserManagement
                credentials={studentCredentials}
                setCredentials={setStudentCredentials}
              />
            )}
          </>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)] flex justify-around p-2 z-50 print:hidden">
        <button
          onClick={() => setActiveTab("student")}
          className={`flex flex-col items-center p-2 ${
            activeTab === "student"
              ? "text-emerald-600 font-bold"
              : "text-slate-400"
          }`}
        >
          <Camera className="w-6 h-6 mb-1" />
          <span className="text-[10px]">บันทึกผล</span>
        </button>

        <button
          onClick={() => setActiveTab("teacher")}
          className={`flex flex-col items-center p-2 relative ${
            activeTab === "teacher"
              ? "text-emerald-600 font-bold"
              : "text-slate-400"
          }`}
        >
          <UserCheck className="w-6 h-6 mb-1" />
          {inspections.filter((i) => i.status === "pending").length > 0 && (
            <span className="absolute top-1 right-2 w-3 h-3 bg-red-500 rounded-full border border-white"></span>
          )}
          <span className="text-[10px]">
            {user.role === "admin" ? "อนุมัติ" : "สถานะ"}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("calendar")}
          className={`flex flex-col items-center p-2 ${
            activeTab === "calendar"
              ? "text-emerald-600 font-bold"
              : "text-slate-400"
          }`}
        >
          <CalendarDays className="w-6 h-6 mb-1" />
          <span className="text-[10px]">ปฏิทิน</span>
        </button>

        {user.role === "admin" && (
          <>
            <button
              onClick={() => setActiveTab("report")}
              className={`flex flex-col items-center p-2 ${
                activeTab === "report"
                  ? "text-emerald-600 font-bold"
                  : "text-slate-400"
              }`}
            >
              <FileText className="w-6 h-6 mb-1" />
              <span className="text-[10px]">รายงาน</span>
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`flex flex-col items-center p-2 ${
                activeTab === "users"
                  ? "text-emerald-600 font-bold"
                  : "text-slate-400"
              }`}
            >
              <Key className="w-6 h-6 mb-1" />
              <span className="text-[10px]">รหัสผ่าน</span>
            </button>
          </>
        )}
      </nav>

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <LogOut className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2 text-center">
              ยืนยันการออกจากระบบ
            </h3>
            <p className="text-slate-500 mb-6 text-center text-sm">
              คุณต้องการออกจากระบบใช่หรือไม่?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-sm"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LoginScreen({ onLogin, schoolLogo, studentCredentials }) {
  const [loginMode, setLoginMode] = useState("student");
  const [studentId, setStudentId] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (loginMode === "student") {
      if (!studentId.trim() || !studentPassword) {
        setError("กรุณากรอกรหัสประจำตัวและรหัสผ่านให้ครบถ้วน");
        return;
      }
      const validUser = studentCredentials.find(
        (c) => c.id === studentId.trim() && c.password === studentPassword
      );
      if (validUser) {
        onLogin({ role: "student", id: validUser.id });
      } else {
        setError("รหัสประจำตัวหรือรหัสผ่านไม่ถูกต้อง");
      }
    } else {
      if (password === "0000") {
        onLogin({ role: "admin" });
      } else {
        setError("รหัสผ่านแอดมินไม่ถูกต้อง");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto bg-slate-50 border-2 border-emerald-100 rounded-full flex items-center justify-center overflow-hidden mb-4 shadow-sm">
            {schoolLogo ? (
              <img
                src={schoolLogo}
                alt="School Logo"
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <Shield className="w-12 h-12 text-emerald-500" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            ระบบตรวจเวรทำความสะอาด
          </h1>
          <p className="text-slate-500">โรงเรียนไตรธารวิทยา</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setLoginMode("student");
              setError("");
            }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              loginMode === "student"
                ? "bg-white shadow text-emerald-700"
                : "text-slate-500 hover:bg-slate-200"
            }`}
          >
            สภานักเรียน
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("admin");
              setError("");
            }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              loginMode === "admin"
                ? "bg-white shadow text-emerald-700"
                : "text-slate-500 hover:bg-slate-200"
            }`}
          >
            ครู / แอดมิน
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {loginMode === "student" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  รหัสประจำตัว (สภานักเรียน)
                </label>
                <div className="relative">
                  <Users className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="เช่น สภา01"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full pl-10 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    placeholder="กรอกรหัสผ่าน"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    className="w-full pl-10 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                รหัสผ่านสำหรับครูผู้ดูแล
              </label>
              <div className="relative">
                <Key className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  placeholder="กรอกรหัสผ่าน"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg mt-4"
          >
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
}

function StudentForm({ onSave, inspections }) {
  const [formData, setFormData] = useState({
    date: getDefaultWeekday(),
    zoneId: "",
    score: null,
    notes: "",
  });
  const [images, setImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const hasExistingInspection = (zoneId, date = formData.date) => {
    if (!zoneId || !date) return false;
    return inspections.some(
      (item) =>
        formatDateKey(item.date) === date &&
        Number(item.zoneId) === Number(zoneId)
    );
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 3) {
      alert("กรุณาอัปโหลดรูปภาพให้ครบ 3 รูปเท่านั้น");
      return;
    }
    try {
      setIsSubmitting(true);
      const compressedImages = await Promise.all(
        files.map((file) => compressImage(file))
      );
      setImages((prev) => [...prev, ...compressedImages]);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการจัดการรูปภาพ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleDateChange = (e) => {
    const selectedDateStr = e.target.value;
    const day = new Date(selectedDateStr).getDay();
    if (day === 0 || day === 6) {
      alert("⚠️ กรุณาเลือกเฉพาะ 'วันจันทร์ - วันศุกร์' เท่านั้นครับ");
      return;
    }
    setFormData({ ...formData, date: selectedDateStr });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.zoneId) return alert("กรุณาเลือกเขตพื้นที่");
    if (hasExistingInspection(formData.zoneId)) {
      return alert(
        "เขตพื้นที่นี้มีการบันทึกข้อมูลในวันที่เลือกแล้ว กรุณาตรวจสอบที่เมนูสถานะงานหรือปฏิทิน"
      );
    }
    if (formData.score === null) return alert("กรุณาให้คะแนน");
    if (images.length !== 3) return alert("กรุณาแนบรูปภาพให้ครบ 3 รูป");

    setIsSubmitting(true);
    try {
      const payload = {
        action: "create",
        id: Date.now().toString(),
        date: formData.date,
        zoneId: parseInt(formData.zoneId),
        score: formData.score,
        notes: formData.notes,
        status: "pending",
        images: images,
      };

      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (result.status === "success") {
        onSave(payload);
        setMessage("บันทึกข้อมูลลงฐานข้อมูลสำเร็จ! รอครูผู้ดูแลยืนยัน");
        setFormData({ ...formData, zoneId: "", score: null, notes: "" });
        setImages([]);
        setTimeout(() => setMessage(""), 4000);
      } else {
        alert("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: " + result.message);
      }
    } catch (e) {
      alert("ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 border-b pb-3">
        <Upload className="text-emerald-500" /> บันทึกการตรวจเวรประจำวัน
      </h2>

      {message && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 shrink-0" /> {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">
              วันที่ตรวจ{" "}
              <span className="text-xs text-red-500 font-normal">
                (จ.-ศ. เท่านั้น)
              </span>
            </label>
            <input
              type="date"
              className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              value={formData.date}
              onChange={handleDateChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">
              เขตพื้นที่รับผิดชอบ
            </label>
            <select
              className="w-full p-3 border rounded-lg outline-none"
              value={formData.zoneId}
              onChange={(e) =>
                setFormData({ ...formData, zoneId: e.target.value })
              }
              required
            >
              <option value="">-- เลือกเขตพื้นที่ --</option>
              {ZONES.map((z) => (
                <option
                  key={z.id}
                  value={z.id}
                  disabled={hasExistingInspection(z.id)}
                >
                  {z.name} ({z.class})
                  {hasExistingInspection(z.id) ? " — บันทึกแล้ว" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {formData.zoneId && (
          <div className="bg-slate-50 p-3 rounded-lg border text-sm text-slate-600">
            <span className="font-semibold text-emerald-700">รายละเอียด:</span>{" "}
            {ZONES.find((z) => z.id === parseInt(formData.zoneId))?.desc}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold mb-2">
            เกณฑ์การให้คะแนน
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RUBRIC.map((r) => (
              <div
                key={r.score}
                onClick={() => setFormData({ ...formData, score: r.score })}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.score === r.score
                    ? r.color
                    : "border-slate-200 hover:border-emerald-300"
                }`}
              >
                <div className="flex justify-between items-center font-bold">
                  <span>
                    {r.score} คะแนน - {r.label}
                  </span>
                  {formData.score === r.score && (
                    <CheckCircle className="w-5 h-5" />
                  )}
                </div>
                <p className="text-xs mt-1 opacity-80">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">
            รูปภาพประกอบ (ต้องแนบ 3 รูป)
          </label>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {images.map((src, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-lg border bg-slate-100 overflow-hidden group"
              >
                <img
                  src={src}
                  alt="Evidence"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
            {[...Array(3 - images.length)].map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-slate-50"
              >
                <Camera className="w-8 h-8 mb-1 opacity-50" />
                <span className="text-xs">
                  รูปที่ {images.length + idx + 1}
                </span>
              </div>
            ))}
          </div>
          {images.length < 3 && (
            <label className="block w-full text-center p-3 bg-slate-100 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-200">
              <span className="font-medium text-emerald-700">
                คลิกเพื่อเลือกรูปภาพ / ถ่ายรูป
              </span>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={images.length >= 3 || isSubmitting}
              />
            </label>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">
            หมายเหตุ / ปัญหาที่พบ (ถ้ามี)
          </label>
          <textarea
            className="w-full p-3 border rounded-lg outline-none"
            rows="2"
            placeholder="เช่น อุปกรณ์ชำรุด..."
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2"
        >
          {isSubmitting ? "กำลังดำเนินการ..." : "บันทึกและส่งข้อมูล"}
        </button>
      </form>
    </div>
  );
}

function InspectionCalendar({ inspections }) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const toDateKey = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayKey = toDateKey(now);
  const [viewMonth, setViewMonth] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const recordsByDate = inspections.reduce((acc, item) => {
    const key = formatDateKey(item.date);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const getDayInfo = (date) => {
    const key = toDateKey(date);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFuture = date > now;
    const records = recordsByDate[key] || [];
    const checkedZoneIds = new Set(
      records
        .map((item) => Number(item.zoneId))
        .filter((zoneId) => ZONES.some((zone) => zone.id === zoneId))
    );
    const checkedCount = checkedZoneIds.size;

    let status = "missing";
    if (isWeekend) status = "weekend";
    else if (isFuture) status = "future";
    else if (checkedCount >= ZONES.length) status = "complete";
    else if (checkedCount > 0) status = "partial";

    return {
      key,
      records,
      checkedCount,
      isWeekend,
      isFuture,
      status,
    };
  };

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingEmptyDays = new Date(year, month, 1).getDay();
  const calendarCells = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const monthSummary = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1);
    return getDayInfo(date);
  }).reduce(
    (summary, day) => {
      if (day.isWeekend || day.isFuture) return summary;
      summary.scheduled += 1;
      summary.checkedZones += day.checkedCount;
      if (day.status === "complete") summary.complete += 1;
      if (day.status === "partial") summary.partial += 1;
      if (day.status === "missing") summary.missing += 1;
      return summary;
    },
    { scheduled: 0, complete: 0, partial: 0, missing: 0, checkedZones: 0 }
  );

  const coveragePercent = monthSummary.scheduled
    ? Math.round(
        (monthSummary.checkedZones /
          (monthSummary.scheduled * ZONES.length)) *
          100
      )
    : 0;

  const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
  const selectedInfo = getDayInfo(selectedDateObject);
  const selectedDateLabel = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(selectedDateObject);
  const monthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
  }).format(viewMonth);

  const changeMonth = (offset) => {
    setViewMonth(new Date(year, month + offset, 1));
  };

  const goToCurrentMonth = () => {
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayKey);
  };

  const statusStyles = {
    complete: {
      cell: "bg-emerald-50 border-emerald-300 hover:bg-emerald-100",
      badge: "bg-emerald-600 text-white",
      label: `ครบ ${ZONES.length}/${ZONES.length}`,
    },
    partial: {
      cell: "bg-amber-50 border-amber-300 hover:bg-amber-100",
      badge: "bg-amber-500 text-white",
      label: `${selectedInfo.checkedCount}/${ZONES.length} เขต`,
    },
    missing: {
      cell: "bg-red-50 border-red-200 hover:bg-red-100",
      badge: "bg-red-500 text-white",
      label: "ยังไม่ตรวจ",
    },
    future: {
      cell: "bg-white border-slate-200 hover:bg-slate-50",
      badge: "bg-slate-100 text-slate-500",
      label: "รอตรวจ",
    },
    weekend: {
      cell: "bg-slate-100 border-slate-200 text-slate-400",
      badge: "bg-slate-200 text-slate-500",
      label: "วันหยุด",
    },
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white shadow-lg">
        <div className="p-5 md:p-7">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">ปฏิทินการตรวจเวร</h2>
                  <p className="text-emerald-100 text-sm">
                    ตรวจสอบวันที่และเขตพื้นที่ที่ยังบันทึกไม่ครบ
                  </p>
                </div>
              </div>
            </div>
            <div className="self-start md:self-auto rounded-full bg-white/15 border border-white/20 px-4 py-2 text-sm font-bold">
              ตรวจเฉพาะวันจันทร์–วันศุกร์
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <div className="rounded-xl bg-white/12 border border-white/15 p-4">
              <p className="text-xs text-emerald-100">ตรวจครบทุกเขต</p>
              <p className="text-2xl font-bold mt-1">
                {monthSummary.complete} วัน
              </p>
            </div>
            <div className="rounded-xl bg-white/12 border border-white/15 p-4">
              <p className="text-xs text-emerald-100">ตรวจบางส่วน</p>
              <p className="text-2xl font-bold mt-1">
                {monthSummary.partial} วัน
              </p>
            </div>
            <div className="rounded-xl bg-white/12 border border-white/15 p-4">
              <p className="text-xs text-emerald-100">ยังไม่ได้ตรวจ</p>
              <p className="text-2xl font-bold mt-1">
                {monthSummary.missing} วัน
              </p>
            </div>
            <div className="rounded-xl bg-white text-emerald-700 p-4 shadow-sm">
              <p className="text-xs text-emerald-600">ความครอบคลุมรายเดือน</p>
              <div className="flex items-end justify-between gap-3 mt-1">
                <p className="text-2xl font-bold">{coveragePercent}%</p>
                <p className="text-[10px] text-slate-500 text-right">
                  {monthSummary.checkedZones}/
                  {monthSummary.scheduled * ZONES.length} เขต
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-5 items-start">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 md:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-100 font-bold text-lg"
                aria-label="เดือนก่อนหน้า"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-100 font-bold text-lg"
                aria-label="เดือนถัดไป"
              >
                ›
              </button>
              <h3 className="font-bold text-lg md:text-xl ml-1 capitalize">
                {monthLabel}
              </h3>
            </div>
            <button
              type="button"
              onClick={goToCurrentMonth}
              className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm font-bold border border-emerald-200"
            >
              เดือนปัจจุบัน
            </button>
          </div>

          <div className="p-2 sm:p-4">
            <div className="grid grid-cols-7 mb-2">
              {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map(
                (day, index) => (
                  <div
                    key={day}
                    className={`py-2 text-center text-xs sm:text-sm font-bold ${
                      index === 0 || index === 6
                        ? "text-rose-400"
                        : "text-slate-500"
                    }`}
                  >
                    {day}
                  </div>
                )
              )}
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarCells.map((day, index) => {
                if (!day)
                  return (
                    <div
                      key={`empty-${index}`}
                      className="min-h-[72px] sm:min-h-[104px]"
                    />
                  );

                const date = new Date(year, month, day);
                const info = getDayInfo(date);
                const style = statusStyles[info.status];
                const isToday = info.key === todayKey;
                const isSelected = info.key === selectedDate;
                const cellLabel =
                  info.status === "complete"
                    ? `ครบ ${ZONES.length}/${ZONES.length}`
                    : info.status === "partial"
                    ? `${info.checkedCount}/${ZONES.length} เขต`
                    : style.label;

                return (
                  <button
                    type="button"
                    key={info.key}
                    onClick={() => setSelectedDate(info.key)}
                    className={`relative min-h-[72px] sm:min-h-[104px] rounded-xl border p-1.5 sm:p-2 text-left transition-all ${
                      style.cell
                    } ${
                      isSelected
                        ? "ring-2 ring-emerald-600 ring-offset-1 shadow-md"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                          isToday
                            ? "bg-emerald-700 text-white"
                            : "text-slate-700"
                        }`}
                      >
                        {day}
                      </span>
                      {info.status === "complete" && (
                        <CheckCircle className="hidden sm:block w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <span
                      className={`absolute left-1.5 right-1.5 bottom-1.5 rounded-md px-1 py-1 text-[9px] sm:text-[11px] text-center font-bold truncate ${style.badge}`}
                    >
                      {cellLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500" /> ตรวจครบ
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400" /> ตรวจบางส่วน
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400" /> ยังไม่ได้ตรวจ
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-300" /> วันหยุด/วันในอนาคต
              </span>
            </div>
          </div>
        </section>

        <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden xl:sticky xl:top-24">
          <div className="p-5 border-b border-slate-200">
            <p className="text-xs font-bold text-emerald-600 mb-1">
              รายละเอียดประจำวันที่เลือก
            </p>
            <h3 className="text-lg font-bold text-slate-800">
              {selectedDateLabel}
            </h3>
            <div className="flex flex-wrap gap-2 mt-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  statusStyles[selectedInfo.status].badge
                }`}
              >
                {selectedInfo.isWeekend
                  ? "ไม่มีการตรวจในวันหยุด"
                  : selectedInfo.isFuture
                  ? "ยังไม่ถึงวันตรวจ"
                  : selectedInfo.status === "complete"
                  ? "ตรวจครบทุกเขต"
                  : selectedInfo.status === "partial"
                  ? `ตรวจแล้ว ${selectedInfo.checkedCount}/${ZONES.length} เขต`
                  : "ยังไม่มีการตรวจ"}
              </span>
            </div>
          </div>

          {selectedInfo.isWeekend ? (
            <div className="p-8 text-center text-slate-500">
              <Clock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-bold">วันเสาร์–อาทิตย์เป็นวันหยุด</p>
              <p className="text-sm mt-1">ระบบไม่นับเป็นวันที่ต้องตรวจเวร</p>
            </div>
          ) : selectedInfo.isFuture ? (
            <div className="p-8 text-center text-slate-500">
              <CalendarDays className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-bold">ยังไม่ถึงกำหนดตรวจ</p>
              <p className="text-sm mt-1">กลับมาตรวจสอบได้เมื่อถึงวันดังกล่าว</p>
            </div>
          ) : (
            <div className="p-4 max-h-[540px] overflow-y-auto">
              <div className="space-y-2">
                {ZONES.map((zone) => {
                  const record = selectedInfo.records.find(
                    (item) => Number(item.zoneId) === zone.id
                  );
                  const recordStatus = record
                    ? record.status === "approved"
                      ? {
                          label: "อนุมัติแล้ว",
                          className: "bg-emerald-100 text-emerald-700",
                        }
                      : record.status === "rejected"
                      ? {
                          label: "ส่งกลับแก้ไข",
                          className: "bg-red-100 text-red-700",
                        }
                      : {
                          label: "รออนุมัติ",
                          className: "bg-amber-100 text-amber-700",
                        }
                    : null;

                  return (
                    <div
                      key={zone.id}
                      className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                        record
                          ? "border-emerald-200 bg-emerald-50/60"
                          : "border-red-100 bg-red-50/60"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            record
                              ? "bg-emerald-600 text-white"
                              : "bg-white text-red-400 border border-red-200"
                          }`}
                        >
                          {record ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            <AlertCircle className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-800">
                            {zone.name} · {zone.class}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {record
                              ? `บันทึกแล้ว · ${record.score}/3 คะแนน`
                              : "ยังไม่มีข้อมูลการตรวจ"}
                          </p>
                        </div>
                      </div>
                      {recordStatus && (
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold whitespace-nowrap ${recordStatus.className}`}
                        >
                          {recordStatus.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TeacherApproval({
  inspections,
  updateStatus,
  updateInspection,
  deleteInspection,
  userRole,
}) {
  const pending = inspections.filter((i) => i.status === "pending");
  const history = inspections
    .filter((i) => i.status !== "pending")
    .slice(0, 15);

  const [editingItem, setEditingItem] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const handleStatusClick = async (id, status) => {
    setProcessingId(id);
    await updateStatus(id, status);
    setProcessingId(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setProcessingId(editingItem.id);
    const success = await updateInspection(editingItem);
    if (success) setEditingItem(null);
    setProcessingId(null);
  };

  const handleEditDateChange = (e) => {
    const selectedDateStr = e.target.value;
    const day = new Date(selectedDateStr).getDay();
    if (day === 0 || day === 6) {
      alert("⚠️ กรุณาเลือกเฉพาะ 'วันจันทร์ - วันศุกร์' เท่านั้นครับ");
      return;
    }
    setEditingItem({ ...editingItem, date: selectedDateStr });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Clock className="text-yellow-500" /> รอการตรวจสอบยืนยัน (
          {pending.length})
        </h2>

        {pending.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p>ไม่มีรายการที่รอการอนุมัติ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((item) => {
              const zone = ZONES.find((z) => z.id === item.zoneId) || {
                name: "เขตไม่ระบุ",
                class: "",
              };
              const isItemProcessing = processingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`border border-yellow-200 bg-yellow-50/30 rounded-xl p-4 flex flex-col ${
                    isItemProcessing ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">
                        {zone.name} ({zone.class})
                      </h3>
                      <p className="text-sm text-slate-500">
                        วันที่: {item.date}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full border border-yellow-300">
                        รอตรวจสอบ
                      </span>
                      {userRole === "admin" && (
                        <button
                          onClick={() => setEditingItem(item)}
                          disabled={isItemProcessing}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-2 py-1 rounded-md shadow-sm"
                        >
                          <Edit className="w-3 h-3" /> แก้ไข
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mb-3">
                    <span className="font-semibold">คะแนนที่สภาประเมิน: </span>
                    <span className="text-lg font-bold text-emerald-600">
                      {item.score}
                    </span>{" "}
                    / 3
                  </div>

                  {item.notes && (
                    <div className="bg-white p-2 rounded border text-sm mb-3 text-slate-600">
                      <span className="font-semibold text-slate-700">
                        หมายเหตุ:
                      </span>{" "}
                      {item.notes}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {item.images &&
                      item.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt="Evidence"
                          className="aspect-square object-cover rounded border"
                          onError={(e) => {
                            e.target.src =
                              "https://placehold.co/400x300?text=No+Image";
                          }}
                        />
                      ))}
                  </div>

                  {userRole === "admin" ? (
                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() => handleStatusClick(item.id, "approved")}
                        disabled={isItemProcessing}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2 shadow-sm"
                      >
                        <CheckCircle className="w-4 h-4" /> อนุมัติ
                      </button>
                      <button
                        onClick={() => handleStatusClick(item.id, "rejected")}
                        disabled={isItemProcessing}
                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg font-medium flex items-center justify-center gap-2 border border-red-200"
                      >
                        <XCircle className="w-4 h-4" /> ปฏิเสธ
                      </button>
                      <button
                        onClick={() => deleteInspection(item.id)}
                        disabled={isItemProcessing}
                        className="bg-red-100 hover:bg-red-200 text-red-600 p-2 rounded-lg transition-colors"
                        title="ลบรายการถาวร"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-auto text-sm text-slate-500 text-center bg-white/50 py-2 rounded-lg border border-slate-200 font-medium">
                      ⏳ รอครูผู้ดูแลตรวจสอบ
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 opacity-90">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-500" />{" "}
          ประวัติการตรวจสอบล่าสุด
        </h2>
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มีประวัติ</p>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100 transition-colors rounded-lg border border-slate-200 text-sm"
              >
                <div>
                  <span className="font-bold text-slate-800">
                    {ZONES.find((z) => z.id === item.zoneId)?.name}
                  </span>
                  <span className="text-slate-500 ml-2">{item.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 mr-2">
                    คะแนน: {item.score}
                  </span>
                  {item.status === "approved" ? (
                    <span className="text-green-700 bg-green-100 px-2 py-1 rounded text-xs font-bold border border-green-200 w-16 text-center">
                      อนุมัติ
                    </span>
                  ) : (
                    <span className="text-red-700 bg-red-100 px-2 py-1 rounded text-xs font-bold border border-red-200 w-16 text-center">
                      ปฏิเสธ
                    </span>
                  )}
                  {userRole === "admin" && (
                    <>
                      <button
                        onClick={() => setEditingItem(item)}
                        className="p-1.5 bg-white rounded-md text-slate-500 hover:text-blue-600 border border-slate-200"
                        title="แก้ไขข้อมูล"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteInspection(item.id)}
                        className="p-1.5 bg-white rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 border border-slate-200"
                        title="ลบข้อมูล"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" /> แก้ไขข้อมูลการตรวจเวร
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg text-sm border border-slate-200">
                <p className="mb-2">
                  <span className="font-bold text-slate-700">เขตพื้นที่:</span>{" "}
                  {ZONES.find((z) => z.id === editingItem.zoneId)?.name}
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันที่ตรวจ{" "}
                    <span className="text-red-500 font-normal">
                      (อนุญาตเฉพาะจันทร์-ศุกร์)
                    </span>
                  </label>
                  <input
                    type="date"
                    value={editingItem.date}
                    onChange={handleEditDateChange}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  สถานะ
                </label>
                <select
                  value={editingItem.status}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, status: e.target.value })
                  }
                  className="w-full p-2.5 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">รอตรวจสอบ</option>
                  <option value="approved">อนุมัติแล้ว (นำไปคำนวณ)</option>
                  <option value="rejected">ไม่อนุมัติ (ไม่นำไปคำนวณ)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  คะแนน (0-3)
                </label>
                <select
                  value={editingItem.score}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      score: parseInt(e.target.value),
                    })
                  }
                  className="w-full p-2.5 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {RUBRIC.map((r) => (
                    <option key={r.score} value={r.score}>
                      {r.score} คะแนน - {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  หมายเหตุ
                </label>
                <textarea
                  value={editingItem.notes}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, notes: e.target.value })
                  }
                  className="w-full p-2.5 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                ></textarea>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportView({ inspections, schoolLogo, setSchoolLogo }) {
  const [selectedReportWeek, setSelectedReportWeek] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [reportMode, setReportMode] = useState("weekly");

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("cleaning_report_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.term) parsed.term = "2";
      if (!parsed.year) parsed.year = "2568";
      if (!parsed.headStudentAffairs)
        parsed.headStudentAffairs = parsed.teacher || "";
      return parsed;
    }
    return {
      president: "",
      teacher: "",
      director: "",
      headStudentAffairs: "",
      term: "2",
      year: "2568",
    };
  });

  useEffect(() => {
    localStorage.setItem("cleaning_report_settings", JSON.stringify(settings));
  }, [settings]);

  const approvedData = inspections.filter((i) => i.status === "approved");
  const WEEKS = Array.from({ length: 21 }, (_, i) => i + 1);

  const getWeekNumFromDate = (dateStr) => {
    if (!dateStr || approvedData.length === 0) return 1;
    const dates = approvedData
      .map((d) => new Date(d.date).getTime())
      .filter((t) => !isNaN(t));
    if (dates.length === 0) return 1;

    const minDate = new Date(Math.min(...dates));
    const day = minDate.getDay();
    const diff = minDate.getDate() - day + (day === 0 ? -6 : 1);

    const semesterStartMonday = new Date(minDate.setDate(diff));
    semesterStartMonday.setHours(12, 0, 0, 0);

    const currentRecordDate = new Date(dateStr);
    currentRecordDate.setHours(12, 0, 0, 0);

    const timeDiff =
      currentRecordDate.getTime() - semesterStartMonday.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    const weekNo = Math.floor(daysDiff / 7) + 1;
    return weekNo >= 1 && weekNo <= 21 ? weekNo : weekNo < 1 ? 1 : 21;
  };

  const getWeekDatesForWeek = (weekNo) => {
    let baseDate = new Date();
    if (approvedData.length > 0) {
      const dates = approvedData
        .map((d) => new Date(d.date).getTime())
        .filter((t) => !isNaN(t));
      baseDate = new Date(Math.min(...dates));
    }

    const day = baseDate.getDay();
    const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);

    const baseMonday = new Date(baseDate.setDate(diff));
    baseMonday.setHours(12, 0, 0, 0);

    baseMonday.setDate(baseMonday.getDate() + (weekNo - 1) * 7);

    const days = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(baseMonday);
      d.setDate(baseMonday.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      days.push(`${yyyy}-${mm}-${dd}`);
    }
    return days;
  };

  const currentWeekDates = getWeekDatesForWeek(selectedReportWeek);

  const getSemesterScore = (weekNo, zoneId) => {
    return approvedData
      .filter(
        (i) => i.zoneId === zoneId && getWeekNumFromDate(i.date) === weekNo
      )
      .reduce((sum, item) => sum + (Number(item.score) || 0), 0);
  };

  const getZoneTotalSemester = (zoneId) => {
    return approvedData
      .filter((i) => i.zoneId === zoneId)
      .reduce((sum, item) => sum + (Number(item.score) || 0), 0);
  };

  const calculateGrade = (percent) => {
    if (percent >= 80) return "ดีเยี่ยม";
    if (percent >= 70) return "ดี";
    if (percent >= 50) return "พอใช้";
    if (percent > 0) return "ปรับปรุง";
    return "-";
  };

  const weeklyFilteredData = approvedData.filter(
    (item) => getWeekNumFromDate(item.date) === selectedReportWeek
  );

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    if (reportMode === "weekly") {
      csvContent += `รายงานสรุปผลการตรวจรายสัปดาห์ สัปดาห์ที่ ${selectedReportWeek}\n`;
      csvContent += "วันที่,เขตพื้นที่,ชั้นที่รับผิดชอบ,คะแนน,หมายเหตุ\n";
      weeklyFilteredData.forEach((item) => {
        const zone = ZONES.find((z) => z.id === item.zoneId);
        const row = `${item.date},${zone?.name},${zone?.fullClass},${
          item.score
        },"${item.notes || "-"}"`;
        csvContent += row + "\n";
      });
    } else {
      csvContent +=
        "สัปดาห์ที่,เขต 1,เขต 2,เขต 3,เขต 4,เขต 5,เขต 6,เขต 7,เขต 8,เขต 9\n";
      WEEKS.forEach((w) => {
        const row = [
          w,
          ...ZONES.map((z) => getSemesterScore(w, z.id) || "0"),
        ].join(",");
        csvContent += row + "\n";
      });
      csvContent += `รวมคะแนน,${ZONES.map((z) =>
        getZoneTotalSemester(z.id)
      ).join(",")}\n`;
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `รายงานตรวจเวร_${
        reportMode === "weekly"
          ? "สัปดาห์ที่_" + selectedReportWeek
          : "ภาคเรียน"
      }.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToWord = () => {
    const element = document.getElementById("printable-area");
    if (!element) return;
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><style>
        @import url('https://cdn.jsdelivr.net/gh/lazywasabi/thai-web-fonts@7/fonts/THSarabunNew/THSarabunNew.css');
        @font-face { font-family: 'TH Sarabun PSK'; }
        @page { size: A4 portrait; margin: 10mm; }
        body, table, td, th, div, p, span, h1, h2, h3 { font-family: 'THSarabunNew', 'TH Sarabun PSK', sans-serif !important; }
        body { font-size: 16pt; }
        table { border-collapse: collapse; margin-bottom: 20px; width: 100%; page-break-inside: auto; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        td, th { border: 1pt solid black !important; padding: 5px; text-align: center; }
        h1, h2 { text-align: center; font-weight: bold; }
    </style></head><body>`;
    const html = header + element.innerHTML + "</body></html>";
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `รายงานตรวจเวร_${
      reportMode === "weekly" ? "สัปดาห์_" + selectedReportWeek : "ภาคเรียน"
    }.doc`;
    link.click();
  };

  const printReport = () => {
    const element = document.getElementById("printable-area");
    if (!element) return;
    setIsPrinting(true);

    // 🚀 PDF ออกแบบเป็นแนวตั้ง (portrait) ขอบ 10mm ไม่ตัดแถวกลางทาง และไม่ล้นขอบ
    const opt = {
      margin: 10,
      filename: `รายงานตรวจเวร_${
        reportMode === "weekly" ? "สัปดาห์_" + selectedReportWeek : "ภาคเรียน"
      }.pdf`,
      image: { type: "jpeg", quality: 1 },
      pagebreak: { mode: ["css", "legacy"] },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    if (!window.html2pdf) {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = () => {
        window
          .html2pdf()
          .set(opt)
          .from(element)
          .save()
          .then(() => setIsPrinting(false));
      };
      document.body.appendChild(script);
    } else {
      window
        .html2pdf()
        .set(opt)
        .from(element)
        .save()
        .then(() => setIsPrinting(false));
    }
  };

  return (
    <div className="space-y-6">
      {/* 🚀 บังคับ CSS สำหรับหน้าพิมพ์โดยเฉพาะ ล็อกขนาด A4 แนวตั้ง ป้องกันการตัดหน้าและขอบแหว่ง */}
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/lazywasabi/thai-web-fonts@7/fonts/THSarabunNew/THSarabunNew.css');
        .font-sarabun, .font-sarabun * { 
          font-family: 'THSarabunNew', 'TH Sarabun PSK', sans-serif !important; 
        }
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .print-reset { overflow: visible !important; display: block !important; position: static !important; transform: none !important; }
          #printable-area { width: 100% !important; max-width: none !important; display: block !important; }
          table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          td, th { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>

      {/* 🛑 ส่วนควบคุม (ปุ่มต่างๆ) ไม่แสดงใน PDF 🛑 */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
              <FileSpreadsheet className="text-emerald-600" /> ระบบส่งออกรายงาน
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              ดึงข้อมูลจริงสรุปผลแยกรายเขตและสัปดาห์
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={exportToCSV}
              className="flex-1 md:flex-none bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
            <button
              onClick={exportToWord}
              className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> Word
            </button>
            <button
              onClick={printReport}
              disabled={isPrinting}
              className="flex-1 md:flex-none bg-slate-800 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />{" "}
              {isPrinting ? "รอสักครู่..." : "PDF"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg gap-1 w-full md:w-fit mb-4">
          <button
            onClick={() => setReportMode("weekly")}
            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${
              reportMode === "weekly"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-600"
            }`}
          >
            <CalendarDays className="w-4 h-4" /> รายงานรายสัปดาห์
          </button>
          <button
            onClick={() => setReportMode("semester")}
            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${
              reportMode === "semester"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-600"
            }`}
          >
            <BarChart3 className="w-4 h-4" /> สรุปผลรายภาคเรียน (21 สัปดาห์)
          </button>
        </div>

        {reportMode === "weekly" && (
          <div className="mb-4 flex items-center gap-3 bg-emerald-50 p-3 rounded-xl border border-emerald-200 animate-in fade-in">
            <label className="font-bold text-emerald-900 text-sm whitespace-nowrap flex items-center gap-1">
              <Clock className="w-4 h-4 text-emerald-600" />{" "}
              เลือกสัปดาห์ย้อนหลังที่ต้องการดูประวัติ:
            </label>
            <select
              value={selectedReportWeek}
              onChange={(e) => setSelectedReportWeek(parseInt(e.target.value))}
              className="p-2 border border-emerald-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-800 outline-none"
            >
              {WEEKS.map((w) => (
                <option key={w} value={w}>
                  สัปดาห์ที่ {w}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              ประธานนักเรียน
            </label>
            <input
              type="text"
              placeholder="ชื่อ-นามสกุล"
              value={settings.president}
              onChange={(e) =>
                setSettings({ ...settings, president: e.target.value })
              }
              className="w-full p-2 border rounded-lg text-sm bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              ครูกิจการนักเรียน
            </label>
            <input
              type="text"
              placeholder="ชื่อ-นามสกุล"
              value={settings.teacher}
              onChange={(e) =>
                setSettings({ ...settings, teacher: e.target.value })
              }
              className="w-full p-2 border rounded-lg text-sm bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              ผู้อำนวยการโรงเรียน
            </label>
            <input
              type="text"
              placeholder="ชื่อ-นามสกุล"
              value={settings.director}
              onChange={(e) =>
                setSettings({ ...settings, director: e.target.value })
              }
              className="w-full p-2 border rounded-lg text-sm bg-slate-50"
            />
          </div>
        </div>
      </div>

      {/* 🚀 Wrapper ชั้นนอก ลบเงาและกรอบออกตอนพิมพ์ เพื่อป้องกันขอบล้นใน PDF */}
      <div className="w-full overflow-x-auto print-reset bg-slate-100 py-6 px-2 md:p-8 rounded-xl print:bg-transparent print:p-0 border border-slate-300 print:border-none">
        {/* 🚀 ล็อกกล่องกระดาษไว้ที่ w-full ให้มันหด-ขยายตัวตาม A4 อัตโนมัติ */}
        <div className="w-full min-w-[794px] print:min-w-0 print:w-full mx-auto bg-white shadow-lg print:shadow-none border border-slate-300 print:border-none print-reset">
          <div
            id="printable-area"
            className="font-sarabun text-[16pt] text-black leading-normal w-full p-8 print:p-0 box-border bg-white print-reset"
          >
            <div
              className={`text-center ${
                reportMode === "semester" ? "mb-2" : "mb-6"
              }`}
            >
              {schoolLogo && (
                <img
                  src={schoolLogo}
                  alt="ตราโรงเรียน"
                  className={`mx-auto object-contain ${
                    reportMode === "semester"
                      ? "h-[70px] mb-1"
                      : "h-[90px] mb-3"
                  }`}
                />
              )}
              {reportMode === "weekly" ? (
                <>
                  <h1 className="text-[22pt] font-bold leading-tight">
                    ตารางบันทึกการปฏิบัติงาน
                    <br />
                    ทำความสะอาดเขตพื้นที่รับผิดชอบ
                  </h1>
                  <h2 className="text-[20pt] font-bold mt-1">
                    โรงเรียนไตรธารวิทยา
                  </h2>
                  {/* 🚀 เปลี่ยนรูปแบบวันที่ให้ตรงเป๊ะ: ประจำสัปดาห์ที่ X (ระหว่างวันที่ ...) */}
                  <p className="mt-2 text-[16pt] font-semibold py-1">
                    ประจำสัปดาห์ที่ {selectedReportWeek} (ระหว่างวันที่{" "}
                    {formatThaiDateShort(currentWeekDates[0])} –{" "}
                    {formatThaiDateShort(currentWeekDates[4])})
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-[22pt] font-bold">
                    แบบสรุปผลการประเมินรายภาคเรียน
                  </h1>
                  <h2 className="text-[20pt] font-bold mt-1">
                    โรงเรียนไตรธารวิทยา
                  </h2>
                  <p className="mt-1 text-[16pt]">
                    ประจำภาคเรียนที่ {settings.term} ปีการศึกษา {settings.year}
                  </p>
                </>
              )}
            </div>

            {reportMode === "weekly" && (
              <>
                <div className="mb-6">
                  <table className="w-full border-collapse border border-black text-[16pt]">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-black py-1 px-2 text-center font-bold w-[40%]">
                          รายการ / เขตพื้นที่
                        </th>
                        <th className="border border-black py-1 px-2 text-center font-bold w-[8%]">
                          จ.
                        </th>
                        <th className="border border-black py-1 px-2 text-center font-bold w-[8%]">
                          อ.
                        </th>
                        <th className="border border-black py-1 px-2 text-center font-bold w-[8%]">
                          พ.
                        </th>
                        <th className="border border-black py-1 px-2 text-center font-bold w-[8%]">
                          พฤ.
                        </th>
                        <th className="border border-black py-1 px-2 text-center font-bold w-[8%]">
                          ศ.
                        </th>
                        <th className="border border-black py-1 px-2 text-center font-bold bg-slate-200 w-[12%]">
                          รวม
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ZONES.map((zone) => {
                        let total = 0;
                        let hasData = false;
                        return (
                          <tr key={zone.id}>
                            <td className="border border-black py-1.5 px-2 font-bold text-left">
                              {zone.name} {zone.fullClass}
                            </td>
                            {currentWeekDates.map((date) => {
                              // 🚀 แก้ปัญหา Date Format ไม่ตรงกัน ทำให้ยอดเงินและช่องคะแนนขึ้นครบ!
                              const record = approvedData.find(
                                (i) =>
                                  i.zoneId === zone.id &&
                                  formatDateKey(i.date) === date
                              );
                              const score = record ? record.score : "-";
                              if (score !== "-") {
                                total += Number(score);
                                hasData = true;
                              }
                              return (
                                <td
                                  key={date}
                                  className="border border-black py-1.5 px-2 text-center"
                                >
                                  {score}
                                </td>
                              );
                            })}
                            <td className="border border-black py-1.5 px-2 text-center font-bold">
                              {hasData ? total : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{ pageBreakInside: "avoid" }}
                  className="mt-10 w-full flex justify-between gap-4 text-center"
                >
                  <div className="flex flex-col items-center flex-1">
                    <div className="mb-4">
                      ลงชื่อ ..........................................
                    </div>
                    <div className="mb-1">
                      (
                      {settings.president
                        ? ` ${settings.president} `
                        : "........................................"}
                      )
                    </div>
                    <div className="text-[16pt] font-bold mt-1">
                      ประธานนักเรียน
                    </div>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <div className="mb-4">
                      ลงชื่อ ..........................................
                    </div>
                    <div className="mb-1">
                      (
                      {settings.teacher
                        ? ` ${settings.teacher} `
                        : "........................................"}
                      )
                    </div>
                    <div className="text-[16pt] font-bold mt-1">
                      ครูกิจการและพัฒนานักเรียน
                    </div>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <div className="mb-4">
                      ลงชื่อ ..........................................
                    </div>
                    <div className="mb-1">
                      (
                      {settings.director
                        ? ` ${settings.director} `
                        : "........................................"}
                      )
                    </div>
                    <div className="text-[16pt] font-bold mt-1">
                      ผู้อำนวยการโรงเรียนไตรธารวิทยา
                    </div>
                  </div>
                </div>

                <div
                  className="mt-12 pt-4"
                  style={{ pageBreakBefore: "always" }}
                >
                  <h2 className="text-[18pt] font-bold pb-2 mb-4">
                    ภาคผนวก: ภาพถ่ายหลักฐานประกอบการตรวจ (สัปดาห์ที่{" "}
                    {selectedReportWeek})
                  </h2>
                  <div className="space-y-4">
                    {weeklyFilteredData.length === 0 ? (
                      <p className="text-center py-6">
                        ไม่มีข้อมูลรูปภาพในสัปดาห์นี้
                      </p>
                    ) : null}
                    {weeklyFilteredData.map((item) => {
                      const zone = ZONES.find((z) => z.id === item.zoneId);
                      return (
                        <div
                          key={item.id}
                          style={{ pageBreakInside: "avoid" }}
                          className="mb-2"
                        >
                          <div className="flex justify-between pb-1 mb-1 font-bold text-[15pt]">
                            <span>
                              {zone ? `${zone.name} - ${zone.class}` : ""}{" "}
                              (วันที่: {formatThaiDateShort(item.date)})
                            </span>
                            <span>
                              คะแนน: {item.score}/3{" "}
                              {item.notes && (
                                <span className="font-normal text-slate-700">
                                  | หมายเหตุ: {item.notes}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {item.images &&
                              item.images.map((img, idx) => (
                                <div key={idx} className="text-center">
                                  <img
                                    src={img}
                                    alt="Evidence"
                                    className="w-full h-[140px] object-cover rounded-md border border-slate-300"
                                    onError={(e) => {
                                      e.target.src =
                                        "https://placehold.co/400x300?text=No+Image";
                                    }}
                                  />
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {reportMode === "semester" && (
              <div className="mb-4">
                <div>
                  <table className="w-full border-collapse border border-black text-[13pt] print:text-[12pt] leading-tight">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-black py-0.5 px-1 text-center font-bold w-[10%]">
                          สัปดาห์ที่
                        </th>
                        {ZONES.map((z) => (
                          <th
                            key={z.id}
                            className="border border-black py-0.5 px-1 text-center font-bold w-[10%]"
                          >
                            {z.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {WEEKS.map((week) => (
                        <tr key={week}>
                          <td className="border border-black py-0.5 px-1 text-center font-bold">
                            {week}
                          </td>
                          {ZONES.map((zone) => {
                            const score = getSemesterScore(week, zone.id);
                            return (
                              <td
                                key={`${week}-${zone.id}`}
                                className="border border-black py-0.5 px-1 text-center"
                              >
                                {score > 0 ? score : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="font-bold bg-slate-50">
                        <td className="border border-black py-1 px-1 text-center whitespace-nowrap align-middle">
                          รวมคะแนน
                        </td>
                        {ZONES.map((zone) => (
                          <td
                            key={`t-${zone.id}`}
                            className="border border-black py-1 px-1 text-center"
                          >
                            {getZoneTotalSemester(zone.id)}
                          </td>
                        ))}
                      </tr>
                      {/* 🚀 แถวคิดเป็น % */}
                      <tr className="font-bold bg-slate-50">
                        <td className="border border-black py-1 px-1 text-center whitespace-nowrap align-middle">
                          คิดเป็น %
                        </td>
                        {ZONES.map((zone) => {
                          const total = getZoneTotalSemester(zone.id);
                          const percent =
                            total > 0 ? ((total / 315) * 100).toFixed(0) : "-";
                          return (
                            <td
                              key={`p-${zone.id}`}
                              className="border border-black py-1 px-1 text-center"
                            >
                              {percent !== "-" ? `${percent}` : "-"}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div
                  style={{ pageBreakInside: "avoid" }}
                  className="mt-6 w-full flex justify-between gap-4"
                >
                  {/* 🚀 กล่องสรุปผล */}
                  <div className="w-[45%] text-[13pt] print:text-[12pt]">
                    {(() => {
                      let ex = 0,
                        gd = 0,
                        fr = 0,
                        im = 0;
                      ZONES.forEach((z) => {
                        const score = getZoneTotalSemester(z.id);
                        const pct = score > 0 ? (score / 315) * 100 : 0;
                        if (pct >= 80) ex++;
                        else if (pct >= 70) gd++;
                        else if (pct >= 50) fr++;
                        else im++;
                      });
                      const totalRooms = ZONES.length;

                      return (
                        <div className="border border-black p-3 bg-white">
                          <p className="font-bold mb-2">สรุปผล:</p>
                          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 mb-4 ml-2">
                            <div>ดีเยี่ยม (80 - 100%)</div>
                            <div>
                              {ex} ห้อง (
                              {totalRooms > 0
                                ? ((ex / totalRooms) * 100)
                                    .toFixed(2)
                                    .replace(/\.00$/, "")
                                : 0}
                              %)
                            </div>

                            <div>ดี (70 - 79%)</div>
                            <div>
                              {gd} ห้อง (
                              {totalRooms > 0
                                ? ((gd / totalRooms) * 100)
                                    .toFixed(2)
                                    .replace(/\.00$/, "")
                                : 0}
                              %)
                            </div>

                            <div>พอใช้ (50 - 69%)</div>
                            <div>
                              {fr} ห้อง (
                              {totalRooms > 0
                                ? ((fr / totalRooms) * 100)
                                    .toFixed(2)
                                    .replace(/\.00$/, "")
                                : 0}
                              %)
                            </div>

                            <div>ปรับปรุง (ต่ำกว่า 50%)</div>
                            <div>
                              {im} ห้อง (
                              {totalRooms > 0
                                ? ((im / totalRooms) * 100)
                                    .toFixed(2)
                                    .replace(/\.00$/, "")
                                : 0}
                              %)
                            </div>
                          </div>
                          <p className="font-bold mt-2">หมายเหตุ :</p>
                          <p className="leading-tight mt-1 ml-2">
                            รางวัลเกียรติยศ "ธงเขียว" และ "เกียรติบัตร"
                            จะมอบให้แก่ห้องเรียนที่มีผลการประเมินอยู่ในระดับ
                            "ดีเยี่ยม" (หรือมีคะแนนสูงสุดในรอบการประเมิน)
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="w-[45%] flex flex-col items-center justify-end pb-4">
                    <div className="mb-4 text-[16pt]">
                      ลงชื่อ
                      ...........................................................
                    </div>
                    <div className="mb-1 text-[16pt]">
                      (
                      {settings.headStudentAffairs
                        ? ` ${settings.headStudentAffairs} `
                        : "..........................................................."}
                      )
                    </div>
                    <div className="text-[16pt]">
                      หัวหน้าฝ่ายกิจการและพัฒนานักเรียน / ผู้รับผิดชอบ
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserManagement({ credentials, setCredentials }) {
  const [newId, setNewId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleAddUser = (e) => {
    e.preventDefault();
    if (!newId.trim() || !newPassword.trim())
      return alert("กรุณากรอกข้อมูลให้ครบ");
    if (credentials.find((c) => c.id === newId.trim()))
      return alert("มีบัญชีนี้แล้ว");
    setCredentials([
      ...credentials,
      { id: newId.trim(), password: newPassword.trim() },
    ]);
    setNewId("");
    setNewPassword("");
    setMessage("เพิ่มสำเร็จ");
    setTimeout(() => setMessage(""), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border p-6 print:hidden">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <UserPlus className="text-emerald-600" /> จัดการรหัสผ่านสภานักเรียน
        </h2>
        <form
          onSubmit={handleAddUser}
          className="flex gap-4 bg-slate-50 p-4 rounded-xl mb-4 items-end"
        >
          <div className="flex-1">
            <label className="block text-xs font-bold mb-1">Username</label>
            <input
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="เช่น สภา02"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold mb-1">Password</label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="รหัสผ่าน"
            />
          </div>
          <button
            type="submit"
            className="bg-emerald-600 text-white p-2 px-6 rounded font-bold"
          >
            เพิ่มบัญชี
          </button>
        </form>
        <table className="w-full text-left bg-white border">
          <thead>
            <tr className="bg-slate-100">
              <th className="p-3">ลำดับ</th>
              <th className="p-3">Username</th>
              <th className="p-3">Password</th>
              <th className="p-3 text-center">ลบ</th>
            </tr>
          </thead>
          <tbody>
            {credentials.map((c, i) => (
              <tr key={c.id} className="border-b">
                <td className="p-3">{i + 1}</td>
                <td className="p-3 font-bold">{c.id}</td>
                <td className="p-3">
                  <span className="bg-slate-100 px-2 py-1 rounded">
                    {c.password}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() =>
                      setCredentials(credentials.filter((u) => u.id !== c.id))
                    }
                    className="text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
