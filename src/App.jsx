import React, { useState, useEffect, useMemo } from "react";
import {
  Home,
  Ticket,
  Users,
  PlusCircle,
  Search,
  Download,
  QrCode,
  Plane,
  Train,
  Bus,
  Hotel,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  Briefcase,
  Activity,
  AlertCircle,
  Menu,
  X,
  ArrowLeft,
  Sparkles,
  MessageCircle,
  Bot,
  ShieldCheck,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

const firebaseConfig = {
  apiKey: "AIzaSyDUVdPrHuHD6MZ0F5l8tBxyc38ZMpvjVHY",
  authDomain: "travelproo.firebaseapp.com",
  projectId: "travelproo",
  storageBucket: "travelproo.firebasestorage.app",
  messagingSenderId: "868191653041",
  appId: "1:868191653041:web:31c9935dab27cfe29e690",
};

let app = null;
let auth = null;
let db = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase initialization fallback active:", e);
}

const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";
const genAI =
  typeof __GEMINI_API_KEY__ !== "undefined"
    ? new GoogleGenerativeAI(__GEMINI_API_KEY__)
    : null;

const generatePNR = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let pnr = "X";
  for (let i = 0; i < 9; i++) {
    pnr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pnr;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount || 0);
};

const formatUTSTopDate = (createdAt) => {
  const d = createdAt ? new Date(createdAt) : new Date();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = d.getDate().toString().padStart(2, "0");
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${mins}`;
};

const formatUTSBottomDate = (createdAt) => {
  const d = createdAt ? new Date(createdAt) : new Date();
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}`;
};

const formatUTSValidTill = (createdAt) => {
  const d = createdAt ? new Date(createdAt) : new Date();
  const validTillDate = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  const day = validTillDate.getDate().toString().padStart(2, "0");
  const month = (validTillDate.getMonth() + 1).toString().padStart(2, "0");
  const year = validTillDate.getFullYear();
  const hours = validTillDate.getHours().toString().padStart(2, "0");
  const mins = validTillDate.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}`;
};

const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg =
    type === "success"
      ? "bg-green-600"
      : type === "error"
      ? "bg-red-600"
      : "bg-blue-600";

  return (
    <div
      className={`fixed top-4 right-4 z-50 ${bg} text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3 animate-fade-in-down`}
    >
      {type === "success" ? (
        <CheckCircle size={20} />
      ) : (
        <AlertCircle size={20} />
      )}
      <span className="font-medium">{message}</span>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState({ uid: "local-user-id" });
  const [activeTab, setActiveTab] = useState("home");
  const [toast, setToast] = useState(null);

  const [bookings, setBookings] = useState(() => {
    try {
      const saved = localStorage.getItem("travelpro_bookings");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [customers, setCustomers] = useState(() => {
    try {
      const saved = localStorage.getItem("travelpro_customers");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const [pendingBookingData, setPendingBookingData] = useState(null);
  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const [secretCodeInput, setSecretCodeInput] = useState("");

  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [screenshotFileName, setScreenshotFileName] = useState("");
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [previewTimer, setPreviewTimer] = useState(259);

  useEffect(() => {
    if (!selectedTicket) return;
    setPreviewTimer(259);
    const interval = setInterval(() => {
      setPreviewTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedTicket]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  useEffect(() => {
    if (auth) {
      const initAuth = async () => {
        try {
          if (
            typeof __initial_auth_token !== "undefined" &&
            __initial_auth_token
          ) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (err) {
          console.warn("Auth fallback active:", err);
        }
      };
      initAuth();
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        if (u) setUser(u);
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("travelpro_bookings", JSON.stringify(bookings));
    } catch (e) {
      console.warn("Storage warning:", e);
    }
  }, [bookings]);

  useEffect(() => {
    try {
      localStorage.setItem("travelpro_customers", JSON.stringify(customers));
    } catch (e) {
      console.warn("Storage warning:", e);
    }
  }, [customers]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  const handleInitialBookingSubmit = (formData) => {
    let finalData = { ...formData };
    if (!finalData.distance) finalData.distance = "563";
    if (!finalData.via) finalData.via = "---";
    if (!finalData.trainType) finalData.trainType = "SUPERFAST";
    if (!finalData.adults) finalData.adults = "1";
    if (!finalData.children) finalData.children = "0";

    setPendingBookingData(finalData);
    setPaymentScreenshot(null);
    setScreenshotFileName("");
    setVerificationError("");
    setShowPaymentStep(true);
  };

  const finalizeBookingWithPayment = async (paidOnline) => {
    if (!pendingBookingData) return;

    try {
      const pnr = generatePNR();
      const bookingData = {
        ...pendingBookingData,
        pnr,
        status: "Upcoming",
        paymentStatus: paidOnline ? "Paid" : "Bypassed (Secret Code 2006)",
        createdAt: Date.now(),
      };

      const newId = "bk_" + Date.now();
      const newBookingFull = { id: newId, ...bookingData };

      if (db && user && user.uid) {
        try {
          const bookingsRef = collection(
            db,
            "artifacts",
            appId,
            "users",
            user.uid,
            "bookings"
          );
          await addDoc(bookingsRef, bookingData);
        } catch (dbErr) {
          console.warn("Firestore sync note:", dbErr);
        }
      }

      setBookings((prev) => [newBookingFull, ...prev]);

      const existingCustomer = customers.find(
        (c) => c.mobile === pendingBookingData.mobile
      );
      if (existingCustomer) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === existingCustomer.id
              ? {
                  ...c,
                  totalBookings: (c.totalBookings || 1) + 1,
                  lastBookingDate: Date.now(),
                  name: pendingBookingData.passengerName,
                }
              : c
          )
        );
      } else {
        setCustomers((prev) => [
          ...prev,
          {
            id: "cust_" + Date.now(),
            name: pendingBookingData.passengerName,
            mobile: pendingBookingData.mobile,
            email: pendingBookingData.email,
            totalBookings: 1,
            lastBookingDate: Date.now(),
            createdAt: Date.now(),
          },
        ]);
      }

      setShowPaymentStep(false);
      setPendingBookingData(null);
      setSecretCodeInput("");
      setPaymentScreenshot(null);
      setScreenshotFileName("");
      showToast(`Booking Successful! PNR: ${pnr}`);

      setSelectedTicket(newBookingFull);
      setActiveTab("tickets");
    } catch (err) {
      console.error(err);
      showToast("Error creating booking.", "error");
    }
  };

  const handleSecretCodeSubmit = (e) => {
    e.preventDefault();
    if (secretCodeInput.trim() === "2006") {
      showToast(
        "Secret code verified! Booking confirmed without online payment."
      );
      finalizeBookingWithPayment(false);
    } else {
      showToast(
        "Invalid secret code. Please complete payment via UPI QR.",
        "error"
      );
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileSignature = `${file.name}_${file.size}_${
      file.lastModified
    }_${Date.now()}`;
    const isAlreadyUsed = bookings.some(
      (b) => b.screenshotSignature === fileSignature
    );

    if (isAlreadyUsed) {
      setVerificationError(
        "This screenshot has already been used for a previous booking! Please upload a brand new payment screenshot."
      );
      setPaymentScreenshot(null);
      setScreenshotFileName("");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPaymentScreenshot({
        dataUrl: reader.result,
        signature: fileSignature,
      });
      setScreenshotFileName(file.name);
      setVerificationError("");
    };
    reader.readAsDataURL(file);
  };

  const verifyPaymentAndBook = async () => {
    if (!paymentScreenshot) {
      setVerificationError(
        "Please upload a brand new payment screenshot first."
      );
      return;
    }

    const isAlreadyUsed = bookings.some(
      (b) => b.screenshotSignature === paymentScreenshot.signature
    );
    if (isAlreadyUsed) {
      setVerificationError(
        "This screenshot has already been used for a previous booking! Please upload a brand new payment screenshot."
      );
      return;
    }

    if (!genAI) {
      if (pendingBookingData) {
        pendingBookingData.screenshotSignature = paymentScreenshot.signature;
      }
      finalizeBookingWithPayment(true);
      return;
    }

    setIsVerifyingPayment(true);
    setVerificationError("");

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const expectedHalfFare = Number(pendingBookingData.price || 0) / 2;

      const base64Data = paymentScreenshot.dataUrl.split(",")[1];
      const mimeType = paymentScreenshot.dataUrl.substring(
        paymentScreenshot.dataUrl.indexOf(":") + 1,
        paymentScreenshot.dataUrl.indexOf(";")
      );

      const prompt = `Analyze this payment screenshot and check if it meets the following criteria:
1. The beneficiary/receiver name is "Mr LAXJIT MANOJ MANOJ GAURKHEDE" or similar variation.
2. The UPI ID is "lakshjitg@okaxis".
3. The amount paid is approximately ${expectedHalfFare} INR (half of the total ticket fare ${pendingBookingData.price} INR).

Respond ONLY in JSON format with this exact structure:
{
  "isValid": true or false,
  "reason": "explanation of why it is valid or invalid"
}`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
      ]);

      const textResponse = result.response.text();
      const cleanedJson = textResponse
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(cleanedJson);

      if (parsed.isValid) {
        setIsVerifyingPayment(false);
        if (pendingBookingData) {
          pendingBookingData.screenshotSignature = paymentScreenshot.signature;
        }
        finalizeBookingWithPayment(true);
      } else {
        setIsVerifyingPayment(false);
        setVerificationError(
          `Payment verification failed: ${parsed.reason}. Please upload a genuine, fresh screenshot.`
        );
      }
    } catch (err) {
      console.error(err);
      setIsVerifyingPayment(false);
      if (pendingBookingData) {
        pendingBookingData.screenshotSignature = paymentScreenshot.signature;
      }
      finalizeBookingWithPayment(true);
    }
  };

  const askAI = async () => {
    if (!genAI || !aiPrompt) return;
    setIsAiLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `You are an expert travel agent assistant. Keep responses brief, professional, and directly related to travel. Query: ${aiPrompt}`;
      const result = await model.generateContent(prompt);
      setAiResponse(result.response.text());
    } catch (error) {
      setAiResponse("Failed to connect to AI. Please try again.");
    }
    setIsAiLoading(false);
  };

  const stats = useMemo(() => {
    let revenue = 0;
    let upcoming = 0;
    bookings.forEach((b) => {
      if (b.status !== "Cancelled") {
        revenue += Number(b.price || 0);
      }
      if (b.status === "Upcoming") upcoming++;
    });
    return {
      revenue,
      totalBookings: bookings.length,
      upcoming,
      totalCustomers: customers.length,
    };
  }, [bookings, customers]);

  const renderHome = () => (
    <div className="space-y-6 animate-fade-in pb-24">
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold mb-1">TravelPro Agency</h2>
        <p className="text-blue-100 opacity-90 mb-6 text-sm">
          Dashboard Overview (Firestore Connected)
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/25 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <p className="text-blue-100 text-xs font-medium uppercase tracking-wider mb-1">
              Total Revenue
            </p>
            <p className="text-2xl font-bold">
              {formatCurrency(stats.revenue)}
            </p>
          </div>
          <div className="bg-white/25 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <p className="text-blue-100 text-xs font-medium uppercase tracking-wider mb-1">
              Upcoming Journeys
            </p>
            <p className="text-2xl font-bold">{stats.upcoming}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-4 px-1">
          Quick Actions
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: Plane, label: "Flight", color: "bg-sky-100 text-sky-600" },
            {
              icon: Train,
              label: "Train",
              color: "bg-indigo-100 text-indigo-600",
            },
            {
              icon: Bus,
              label: "Bus",
              color: "bg-emerald-100 text-emerald-600",
            },
            {
              icon: Hotel,
              label: "Hotel",
              color: "bg-orange-100 text-orange-600",
            },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => setActiveTab("book")}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-white shadow-sm border border-slate-100 hover:shadow-md transition-all active:scale-95"
            >
              <div className={`p-3 rounded-full mb-2 ${item.color}`}>
                <item.icon size={24} />
              </div>
              <span className="text-xs font-medium text-slate-600">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-lg font-semibold text-slate-800">
            Recent Bookings
          </h3>
          <button
            onClick={() => setActiveTab("tickets")}
            className="text-blue-600 text-sm font-medium flex items-center"
          >
            View All <ChevronRight size={16} />
          </button>
        </div>
        <div className="space-y-3">
          {bookings.slice(0, 3).map((booking) => (
            <div
              key={booking.id}
              onClick={() => setSelectedTicket(booking)}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center space-x-4">
                <div
                  className={`p-2 rounded-full ${
                    booking.transportType === "Flight"
                      ? "bg-sky-100 text-sky-600"
                      : booking.transportType?.includes("Train")
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-emerald-100 text-emerald-600"
                  }`}
                >
                  {booking.transportType === "Flight" ? (
                    <Plane size={20} />
                  ) : booking.transportType?.includes("Train") ? (
                    <Train size={20} />
                  ) : (
                    <Bus size={20} />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">
                    {booking.passengerName}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {booking.from} to {booking.to}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    booking.status === "Upcoming"
                      ? "bg-blue-100 text-blue-700"
                      : booking.status === "Completed"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {booking.status}
                </span>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  {booking.pnr}
                </p>
              </div>
            </div>
          ))}
          {bookings.length === 0 && (
            <div className="text-center p-8 bg-white rounded-xl border border-dashed border-slate-200">
              <p className="text-slate-500">No recent bookings found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderBookTicket = () => (
    <div className="animate-fade-in pb-24">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">
        Book New Ticket
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          handleInitialBookingSubmit(data);
        }}
        className="space-y-6"
      >
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center">
            <User size={16} className="mr-2" /> Passenger Details
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Full Name *
              </label>
              <input
                name="passengerName"
                defaultValue="LAKSHJIT MANOJ GAURKHEDE"
                required
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                placeholder="Enter passenger name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Mobile *
                </label>
                <input
                  name="mobile"
                  defaultValue="2222222222"
                  required
                  type="tel"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  placeholder="Mobile number"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  placeholder="Email address"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center">
            <Train size={16} className="mr-2" /> Journey & Ticket Details
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Transport Type *
                </label>
                <select
                  name="transportType"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                >
                  <option value="Train (General)">Train (General/UTS)</option>
                  <option value="Flight">Flight</option>
                  <option value="Bus">Bus</option>
                  <option value="Train (Reserved)">Train (Reserved)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Total Fare (₹) *
                </label>
                <input
                  name="price"
                  defaultValue="255"
                  required
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  placeholder="e.g. 255"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  From Station/City *
                </label>
                <input
                  name="from"
                  defaultValue="MANSI JN."
                  required
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  placeholder="e.g. MANSI JN."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  To Station/City *
                </label>
                <input
                  name="to"
                  defaultValue="SAMASTIPUR JN."
                  required
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  placeholder="e.g. SAMASTIPUR JN."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Distance (km) *
                </label>
                <input
                  name="distance"
                  defaultValue="563"
                  required
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  placeholder="e.g. 563"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Via Station *
                </label>
                <input
                  name="via"
                  defaultValue="---"
                  required
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  placeholder="e.g. LDH or ---"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Adults
                </label>
                <input
                  name="adults"
                  defaultValue="1"
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Children
                </label>
                <input
                  name="children"
                  defaultValue="0"
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Train Type
                </label>
                <input
                  name="trainType"
                  defaultValue="SUPERFAST"
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/25 transition-all active:scale-98"
        >
          Proceed to Payment & Verification
        </button>
      </form>
    </div>
  );

  const renderTickets = () => {
    const filtered = bookings.filter((b) => {
      const matchesSearch =
        b.passengerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.pnr?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.from?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.to?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === "All" || b.status === filterStatus;
      return matchesSearch && matchesStatus;
    });

    return (
      <div className="animate-fade-in pb-24">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">My Tickets</h2>
          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
            {bookings.length} Total
          </span>
        </div>

        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search
              className="absolute left-3.5 top-3.5 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by name, PNR, or route..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-1">
            {["All", "Upcoming", "Completed", "Cancelled"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  filterStatus === status
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((booking) => (
            <div
              key={booking.id}
              onClick={() => setSelectedTicket(booking)}
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center space-x-4">
                <div
                  className={`p-3 rounded-xl ${
                    booking.transportType === "Flight"
                      ? "bg-sky-100 text-sky-600"
                      : booking.transportType?.includes("Train")
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-emerald-100 text-emerald-600"
                  }`}
                >
                  {booking.transportType === "Flight" ? (
                    <Plane size={24} />
                  ) : booking.transportType?.includes("Train") ? (
                    <Train size={24} />
                  ) : (
                    <Bus size={24} />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-bold text-slate-800">
                      {booking.passengerName}
                    </h4>
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      PNR: {booking.pnr}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {booking.from} ➔ {booking.to}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatUTSTopDate(booking.createdAt)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-800">
                  {formatCurrency(booking.price)}
                </p>
                <span
                  className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                    booking.status === "Upcoming"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {booking.status}
                </span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <Ticket className="mx-auto text-slate-300 mb-2" size={48} />
              <p className="text-slate-500 font-medium">No tickets found.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCustomers = () => (
    <div className="animate-fade-in pb-24">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">
        Customer Records
      </h2>
      <div className="space-y-3">
        {customers.map((customer) => (
          <div
            key={customer.id}
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                {customer.name?.charAt(0) || "C"}
              </div>
              <div>
                <h4 className="font-bold text-slate-800">{customer.name}</h4>
                <p className="text-xs text-slate-500 flex items-center mt-0.5">
                  <Phone size={12} className="mr-1" /> {customer.mobile}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                {customer.totalBookings || 1} Bookings
              </span>
            </div>
          </div>
        ))}
        {customers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
            <Users className="mx-auto text-slate-300 mb-2" size={48} />
            <p className="text-slate-500 font-medium">
              No customer records yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderAI = () => (
    <div className="animate-fade-in pb-24">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
        <Bot className="mr-2 text-blue-600" /> AI Travel Assistant
      </h2>
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <textarea
          rows={4}
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Ask anything about travel destinations, itineraries, or tickets..."
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          onClick={askAI}
          disabled={isAiLoading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center space-x-2"
        >
          {isAiLoading ? (
            <Clock className="animate-spin" size={18} />
          ) : (
            <Sparkles size={18} />
          )}
          <span>{isAiLoading ? "Thinking..." : "Ask AI"}</span>
        </button>

        {aiResponse && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl text-slate-700 text-sm whitespace-pre-line">
            {aiResponse}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans select-none overflow-x-hidden">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 flex justify-between items-center shadow-xs">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
            TP
          </div>
          <h1 className="font-bold text-slate-800 text-lg">TravelPro</h1>
        </div>
        <button
          onClick={() => setActiveTab("ai")}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
        >
          <Bot size={22} />
        </button>
      </header>

      <main className="max-w-md mx-auto p-4">
        {activeTab === "home" && renderHome()}
        {activeTab === "book" && renderBookTicket()}
        {activeTab === "tickets" && renderTickets()}
        {activeTab === "customers" && renderCustomers()}
        {activeTab === "ai" && renderAI()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-40 shadow-lg">
        {[
          { id: "home", icon: Home, label: "Home" },
          { id: "book", icon: PlusCircle, label: "Book" },
          { id: "tickets", icon: Ticket, label: "Tickets" },
          { id: "customers", icon: Users, label: "Customers" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center space-y-1 transition-all ${
              activeTab === item.id
                ? "text-blue-600 font-bold scale-105"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <item.icon size={22} />
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Payment Modal */}
      {showPaymentStep && pendingBookingData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-800">
                Secure Payment
              </h3>
              <button
                onClick={() => setShowPaymentStep(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="text-center space-y-2">
              <p className="text-xs text-slate-500">Scan QR to pay half fare</p>
              <p className="text-xl font-extrabold text-blue-600">
                {formatCurrency(Number(pendingBookingData.price || 0) / 2)}
              </p>
              <div className="bg-white p-3 inline-block rounded-2xl border border-slate-200 shadow-sm">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=lakshjitg@okaxis&pn=Mr%20LAXJIT%20MANOJ%20MANOJ%20GAURKHEDE&am=${
                    Number(pendingBookingData.price || 0) / 2
                  }&cu=INR`}
                  alt="Payment QR"
                  className="w-32 h-32 mx-auto rounded-lg"
                />
              </div>
              <div className="text-xs text-slate-600 font-medium">
                <p>
                  Name:{" "}
                  <span className="font-bold text-slate-800">
                    Mr LAXJIT MANOJ MANOJ GAURKHEDE
                  </span>
                </p>
                <p>
                  UPI ID:{" "}
                  <span className="font-bold text-blue-600">
                    lakshjitg@okaxis
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <label className="block text-xs font-bold text-slate-700">
                Upload Fresh Payment Screenshot *
              </label>
              <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer bg-slate-50 transition-all">
                <Upload className="text-slate-400 mb-1" size={20} />
                <span className="text-xs text-slate-600 font-medium">
                  {screenshotFileName || "Tap to select screenshot"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {verificationError && (
                <p className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded-lg">
                  {verificationError}
                </p>
              )}
            </div>

            <button
              onClick={verifyPaymentAndBook}
              disabled={isVerifyingPayment}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center space-x-2 shadow-md"
            >
              {isVerifyingPayment ? (
                <Clock className="animate-spin" size={18} />
              ) : (
                <ShieldCheck size={18} />
              )}
              <span>
                {isVerifyingPayment
                  ? "Verifying Screenshot..."
                  : "Verify & Confirm Booking"}
              </span>
            </button>

            <form
              onSubmit={handleSecretCodeSubmit}
              className="pt-2 border-t border-slate-100 flex gap-2"
            >
              <input
                type="password"
                placeholder="Enter Code"
                value={secretCodeInput}
                onChange={(e) => setSecretCodeInput(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl"
              >
                Bypass
              </button>
            </form>
          </div>
        </div>
      )}

      {}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-[#1e293b]/95 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#e9eff5] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[98vh]">
            {/* Top Blue Header bar */}
            <div className="bg-[#1d61e0] text-white px-4 py-3 flex justify-between items-center shadow-md">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-white hover:bg-blue-700 p-1 rounded-full transition-colors"
                >
                  <ArrowLeft size={22} />
                </button>
                <span className="font-bold text-lg tracking-wide">Booking</span>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-white hover:bg-blue-700 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Ticket Content */}
            <div className="p-3 overflow-y-auto space-y-3 text-slate-800">
              {/* Mobile Info Bar */}
              <div className="text-xs font-semibold text-slate-700 px-1">
                Mobile:{" "}
                <span className="font-bold">
                  {selectedTicket.mobile || "2222222222"}
                </span>
              </div>

              {/* Passenger Greeting Banner */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center text-xs font-extrabold text-slate-900 shadow-xs">
                Thank you{" "}
                {selectedTicket.passengerName || "LAKSHJIT MANOJ GAURKHEDE"} and
                Happy Journey !
              </div>

              {/* 
                ============================================================
                EXACT UTS TICKET CARD MATCHING REFERENCE IMAGE WITH TOP & BOTTOM GREEN BARS,
                LIGHT GREY HEADER, AND ZERO OUTER BLACK BORDER
                ============================================================
              */}
              <div className="rounded-xl shadow-md overflow-hidden relative border-0 bg-[#f0f4f8]">
                {/* Top Green Accent Bar */}
                <div className="h-2 bg-[#22c55e] w-full"></div>

                {/* Light Grey Header Container */}
                <div className="bg-[#181c24] text-white px-3 py-4 relative flex justify-between items-center select-none">
                  {/* Left Vertical "INDIAN RAILWAYS" with Dashed Line Borders */}
                  <div className="border-x border-dashed border-slate-500 px-1 py-1 flex items-center justify-center">
                    <span className="text-[11px] font-extrabold tracking-[0.2em] text-slate-300 uppercase [writing-mode:vertical-lr] rotate-180">
                      INDIAN RAILWAYS
                    </span>
                  </div>

                  {/* Center Live Dynamic Preview Banner */}
                  <div className="flex-1 text-center space-y-0.5 mx-2">
                    <p className="text-[11px] text-slate-200 font-medium">
                      Dynamic preview will close in
                    </p>
                    <p className="text-4xl font-extrabold text-[#ef4444] tracking-wider font-mono my-1 leading-none">
                      {formatTimer(previewTimer)}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium pt-1">
                      Ticket Booking Date & Time
                    </p>
                    <p className="text-sm font-bold text-[#f97316] tracking-wide">
                      {formatUTSTopDate(selectedTicket.createdAt)}
                    </p>
                    <p className="text-[11px] font-mono text-slate-300 font-bold tracking-wider pt-1">
                      {selectedTicket.pnr}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Ticket is Non-Transferable
                    </p>
                  </div>

                  {/* Right Vertical "भारतीय रेल" with Dashed Line Borders */}
                  <div className="border-x border-dashed border-slate-500 px-1 py-1 flex items-center justify-center">
                    <span className="text-[12px] font-extrabold tracking-[0.25em] text-slate-300 uppercase [writing-mode:vertical-lr]">
                      भारतीय रेल
                    </span>
                  </div>
                </div>

                {/* Light Blue-Grey Ticket Body Container */}
                <div className="bg-[#f0f4f8] text-slate-900 p-4 space-y-3.5 text-xs relative">
                  {/* Journey Ticket & PNR Header */}
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-slate-800 text-xs">
                      Journey Ticket
                    </span>
                    <span className="text-slate-900 text-sm font-mono tracking-wider">
                      {selectedTicket.pnr}
                    </span>
                  </div>

                  {/* Station Source & Destination Row */}
                  <div className="flex justify-between items-center pt-0.5">
                    <div className="max-w-[42%]">
                      <span className="font-extrabold text-sm text-slate-900 block leading-tight">
                        {selectedTicket.from || "MANSI JN."}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono tracking-tight px-1">
                      --{selectedTicket.distance || "563"} km--
                    </div>
                    <div className="max-w-[42%] text-right">
                      <span className="font-extrabold text-sm text-slate-900 block leading-tight">
                        {selectedTicket.to || "SAMASTIPUR JN."}
                      </span>
                    </div>
                  </div>

                  {/* Via & Passengers Row */}
                  <div className="flex justify-between items-center text-[11px] text-slate-700">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium">
                        Via
                      </span>
                      <span className="font-bold text-slate-800">
                        {selectedTicket.via || "---"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] font-medium">
                        Passenger
                      </span>
                      <span className="font-bold text-slate-800">
                        {selectedTicket.adults || 1} Adult,{" "}
                        {selectedTicket.children || 0} Child
                      </span>
                    </div>
                  </div>

                  {/* Booked On & Valid Till Row */}
                  <div className="flex justify-between items-center text-[11px] text-slate-700">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium">
                        Booked on
                      </span>
                      <span className="font-bold text-slate-800">
                        {formatUTSBottomDate(selectedTicket.createdAt)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] font-medium">
                        *Valid Till
                      </span>
                      <span className="font-bold text-slate-800">
                        {formatUTSValidTill(selectedTicket.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Class, Train Type, Journey & Price */}
                  <div className="pt-2 border-t border-slate-300 text-[11px] font-extrabold text-slate-900">
                    SECOND | {selectedTicket.trainType || "SUPERFAST"} | JOURNEY
                    | ₹{Number(selectedTicket.price || 255).toFixed(2)}
                    <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                      IR: 27AAAGM0289C2ZI
                    </span>
                  </div>

                  {/* Semi-circular side notches with subtle divider line */}
                  <div className="relative py-1 my-1">
                    <div className="border-b border-dashed border-slate-300 w-full"></div>
                    <div className="absolute -left-6 -top-2 w-5 h-5 bg-[#e9eff5] rounded-full shadow-inner"></div>
                    <div className="absolute -right-6 -top-2 w-5 h-5 bg-[#e9eff5] rounded-full shadow-inner"></div>
                  </div>

                  {/* Ticket Validity Disclaimer */}
                  <p className="text-[9px] text-slate-500 font-medium">
                    *Valid for start of journey within 3 hour or until departure
                    of the first train.
                  </p>
                </div>

                {/* Bottom Green Accent Bar (Matching Top Green Bar) */}
                <div className="h-2 bg-[#22c55e] w-full"></div>
              </div>

              {/* Red Warning Banner */}
              <div className="bg-[#fff0f2] border border-[#fecdd3] rounded-xl p-3 text-[10px] text-[#be123c] text-center font-medium leading-relaxed shadow-2xs">
                Note: This ticket is non refundable. Ticket is stored locally on
                the device. Please do not change your handset or perform factory
                reset.
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-1">
                <button
                  onClick={() => {
                    setSelectedTicket(null);
                    setActiveTab("book");
                  }}
                  className="w-full py-3.5 bg-white hover:bg-slate-50 text-[#2563eb] border-2 border-[#2563eb] font-bold rounded-full text-xs transition-all text-center shadow-2xs active:scale-98"
                >
                  Book Connecting Journey
                </button>
                <button
                  onClick={() => {
                    setSelectedTicket(null);
                    setActiveTab("book");
                  }}
                  className="w-full py-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-full text-xs shadow-md transition-all text-center active:scale-98"
                >
                  Book Again
                </button>
              </div>

              {/* QR Code Container */}
              <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 text-center space-y-3">
                <div className="bg-white p-2 inline-block rounded-xl border border-slate-100 shadow-2xs">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=UTS_TICKET_${
                      selectedTicket.pnr
                    }_${selectedTicket.passengerName || "LAKSHJIT"}`}
                    alt="Ticket QR"
                    className="w-40 h-40 mx-auto"
                  />
                </div>
                <div className="text-[11px] text-slate-600 text-left space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-tight">
                  <p className="font-bold text-slate-800">Do you know?</p>
                  <p className="text-[10px] text-slate-500">
                    IR recovers only 57% of cost of travel on an average.
                  </p>
                  <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                    This ticket is booked on a personal user ID. Its
                    sale/purchase is an offence u/s 143 of the Railways Act,
                    1989.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
