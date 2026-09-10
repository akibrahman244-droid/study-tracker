"use client";
import { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Home() {
  // --- Real Gmail Login via NextAuth ---
  const { data: session, status } = useSession();
  const user = session?.user
    ? { name: session.user.name || "User", email: session.user.email, image: session.user.image }
    : null;

  const handleGoogleSignInClick = () => signIn("google");
  const handleLogout = () => signOut();

  // --- "আমাকে মনে রাখো" (Remember Me) লজিক ---
  // NextAuth ডিফল্টভাবে ~৩০ দিন লগইন মনে রাখে। "মনে রাখো" আনচেক করলে
  // ব্রাউজার সম্পূর্ণ বন্ধ করে আবার খুললে (নতুন সেশন) স্বয়ংক্রিয়ভাবে লগ-আউট হয়ে যাবে।
  const [rememberMe, setRememberMe] = useState(true);
  useEffect(() => {
    const saved = localStorage.getItem("studyTracker:rememberMe");
    if (saved !== null) setRememberMe(saved === "true");
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    const remembered = localStorage.getItem("studyTracker:rememberMe");
    const freshSession = !sessionStorage.getItem("studyTracker:sessionActive");
    sessionStorage.setItem("studyTracker:sessionActive", "true");
    if (remembered === "false" && freshSession) {
      signOut();
    }
  }, [status]);

  const handleToggleRememberMe = () => {
    const next = !rememberMe;
    setRememberMe(next);
    localStorage.setItem("studyTracker:rememberMe", String(next));
  };

  const [activeTab, setActiveTab] = useState("my"); // "my", "friend", "group"

  // ক্রেডিট অনুযায়ী সাজানোর হেল্পার ফাংশন (পিন করা কোর্স সবার উপরে, এরপর বেশি ক্রেডিট)
  const sortCoursesWithPin = (list) => {
    return [...list].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.credit - a.credit;
    });
  };

  // আমার কোর্সের ডেটা
  const [myCourses, setMyCourses] = useState([]);

  // বন্ধুর কোর্সের ডেটা
  const [friendCourses, setFriendCourses] = useState([]);

  // --- স্টাডি রুম / গ্রুপ স্টেট ---
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  // --- ইউজারের ডেটা সেভ/লোড (Gmail অনুযায়ী, এই ব্রাউজারে) ---
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const currentEmailRef = useRef(null);

  useEffect(() => {
    if (!user?.email) {
      setDataLoaded(false);
      return;
    }
    currentEmailRef.current = user.email;
    (async () => {
      try {
        const res = await fetch("/api/data");
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setMyCourses(data.myCourses || []);
            setFriendCourses(data.friendCourses || []);
            setRooms(data.rooms || []);
            setSelectedRoomId(data.selectedRoomId ?? null);
          } else {
            setMyCourses([]);
            setFriendCourses([]);
            setRooms([]);
            setSelectedRoomId(null);
          }
        }
      } catch (e) {
        // নেটওয়ার্ক সমস্যা হলে ডেটা লোড হবে না, সার্ভারে সেভ আছে কিন্তু নষ্ট হবে না
      }
      setDataLoaded(true);
    })();
  }, [user?.email]);

  useEffect(() => {
    if (!dataLoaded || !currentEmailRef.current) return;
    const payload = { myCourses, friendCourses, rooms, selectedRoomId };
    setIsSyncing(true);
    const t = setTimeout(() => {
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .catch(() => {})
        .finally(() => setIsSyncing(false));
    }, 700);
    return () => clearTimeout(t);
  }, [myCourses, friendCourses, rooms, selectedRoomId, dataLoaded]);

  // Modals State
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [courseNameInput, setCourseNameInput] = useState("");
  const [courseCreditInput, setCourseCreditInput] = useState("3");
  const [teacher1Input, setTeacher1Input] = useState("");
  const [teacher2Input, setTeacher2Input] = useState("");
  const [chapterInputs, setChapterInputs] = useState([{ name: "", teacher: "teacher1" }]);

  const [addChapterModal, setAddChapterModal] = useState({ isOpen: false, courseId: null, name: "", teacher: "teacher1" });
  const [addTopicModal, setAddTopicModal] = useState({ isOpen: false, courseId: null, chapterId: null, name: "" });
  const [editChapterModal, setEditChapterModal] = useState({ isOpen: false, courseId: null, chapterId: null, name: "", teacher: "teacher1" });
  const [markModal, setMarkModal] = useState({ isOpen: false, type: "", courseId: null, ctIndex: null, value: "" });
  const [renameCourseModal, setRenameCourseModal] = useState({ isOpen: false, courseId: null, name: "", teacher1: "", teacher2: "" });

  // Room Modals State
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [isJoinRoomModalOpen, setIsJoinRoomModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCode, setNewRoomCode] = useState("");
  const [joinRoomCodeInput, setJoinRoomCodeInput] = useState("");

  // প্রতিটা কোর্সে শিক্ষক-ভিত্তিক সেকশন (teacher1/teacher2) খোলা/বন্ধ রাখার স্টেট
  const [expandedTeacherSections, setExpandedTeacherSections] = useState({});
  const toggleTeacherSection = (key) => {
    setExpandedTeacherSections((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  };

  const currentCourses = activeTab === "my" ? myCourses : friendCourses;
  const currentRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0];

  // ৪টি CT-র মধ্যে সেরা ৩টির গড় (Best 3 of 4)
  const getBest3Average = (marks) => {
    if (!marks || marks.length === 0) return "0.0";
    const sorted = [...marks].sort((a, b) => b - a);
    const best3 = sorted.slice(0, 3);
    const sum = best3.reduce((acc, curr) => acc + curr, 0);
    return (sum / best3.length).toFixed(1);
  };

  // নিজের সব কোর্স থেকে সামগ্রিক প্রগ্রেস % ও গড় CT বের করা (স্টাডি রুমে দেখানোর জন্য)
  const getMyOverallStats = () => {
    if (myCourses.length === 0) return { progress: 0, avgCt: "0.0" };
    let totalPercent = 0;
    let totalAvg = 0;
    let avgCount = 0;
    myCourses.forEach((c) => {
      const completed = c.chapters.filter((ch) => ch.done).length;
      const percent = c.chapters.length > 0 ? (completed / c.chapters.length) * 100 : 0;
      totalPercent += percent;
      const best3 = parseFloat(getBest3Average(c.ctMarks));
      if (!isNaN(best3) && best3 > 0) {
        totalAvg += best3;
        avgCount++;
      }
    });
    return {
      progress: Math.round(totalPercent / myCourses.length),
      avgCt: avgCount > 0 ? (totalAvg / avgCount).toFixed(1) : "0.0",
    };
  };

  // চ্যাপ্টারের teacher key ("teacher1"/"teacher2") থেকে আসল শিক্ষকের নাম বের করা
  const getTeacherLabel = (course, teacherKey) => {
    if (teacherKey === "teacher2") return course.teacher2 && course.teacher2.trim() ? course.teacher2 : "শিক্ষক ২";
    return course.teacher1 && course.teacher1.trim() ? course.teacher1 : "শিক্ষক ১";
  };

  // --- Course Pin & Shuffle Handlers ---
  const handleTogglePin = (courseId) => {
    const targetCourses = activeTab === "my" ? myCourses : friendCourses;
    const updated = targetCourses.map((c) =>
      c.id === courseId ? { ...c, isPinned: !c.isPinned } : c
    );

    const sorted = sortCoursesWithPin(updated);

    if (activeTab === "my") setMyCourses(sorted);
    else setFriendCourses(sorted);
  };

  const handleOpenRenameCourse = (course) => {
    setRenameCourseModal({
      isOpen: true,
      courseId: course.id,
      name: course.name,
      teacher1: course.teacher1 || "",
      teacher2: course.teacher2 || "",
    });
  };

  const handleSaveRenameCourse = () => {
    if (!renameCourseModal.name.trim()) return;
    const updated = myCourses.map((c) =>
      c.id === renameCourseModal.courseId
        ? {
            ...c,
            name: renameCourseModal.name.trim(),
            teacher1: renameCourseModal.teacher1.trim(),
            teacher2: renameCourseModal.teacher2.trim(),
          }
        : c
    );
    setMyCourses(updated);
    setRenameCourseModal({ isOpen: false, courseId: null, name: "", teacher1: "", teacher2: "" });
  };

  const handleDeleteCourse = (courseId) => {
    if (activeTab !== "my") return;
    const updated = myCourses.filter((c) => c.id !== courseId);
    setMyCourses(updated);
  };

  const handleMoveCourse = (index, direction) => {
    const targetCourses = activeTab === "my" ? myCourses : friendCourses;
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= targetCourses.length) return;

    const updated = [...targetCourses];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    if (activeTab === "my") setMyCourses(updated);
    else setFriendCourses(updated);
  };

  const handleSortByCredit = () => {
    const targetCourses = activeTab === "my" ? myCourses : friendCourses;
    const sorted = sortCoursesWithPin(targetCourses);

    if (activeTab === "my") setMyCourses(sorted);
    else setFriendCourses(sorted);
  };

  // --- Chapter Expand/Collapse ---
  const toggleExpandChapter = (courseId, chapterId) => {
    const updated = currentCourses.map((c) => {
      if (c.id === courseId) {
        const updatedChapters = c.chapters.map((ch) => {
          if (ch.id === chapterId) {
            return { ...ch, expanded: !ch.expanded };
          }
          return ch;
        });
        return { ...c, chapters: updatedChapters };
      }
      return c;
    });

    if (activeTab === "my") setMyCourses(updated);
    else setFriendCourses(updated);
  };

  // --- Chapter / Topic Checkbox Handlers ---
  const toggleChapterDone = (courseId, chapterId, e) => {
    e.stopPropagation();
    if (activeTab !== "my") return;

    const updated = myCourses.map((course) => {
      if (course.id === courseId) {
        const updatedChapters = course.chapters.map((ch) => {
          if (ch.id === chapterId) {
            const nextDone = !ch.done;
            const updatedTopics = (ch.topics || []).map((t) => ({ ...t, done: nextDone }));
            return { ...ch, done: nextDone, topics: updatedTopics };
          }
          return ch;
        });
        return { ...course, chapters: updatedChapters };
      }
      return course;
    });
    setMyCourses(updated);
  };

  const toggleTopicDone = (courseId, chapterId, topicId) => {
    if (activeTab !== "my") return;

    const updated = myCourses.map((course) => {
      if (course.id === courseId) {
        const updatedChapters = course.chapters.map((ch) => {
          if (ch.id === chapterId) {
            const updatedTopics = ch.topics.map((t) => (t.id === topicId ? { ...t, done: !t.done } : t));
            const allDone = updatedTopics.length > 0 && updatedTopics.every((t) => t.done);
            return { ...ch, topics: updatedTopics, done: allDone };
          }
          return ch;
        });
        return { ...course, chapters: updatedChapters };
      }
      return course;
    });
    setMyCourses(updated);
  };

  // --- Add Course Logic ---
  const handleOpenCourseModal = () => {
    setCourseNameInput("");
    setCourseCreditInput("3");
    setTeacher1Input("");
    setTeacher2Input("");
    setChapterInputs([{ name: "", teacher: "teacher1" }]);
    setIsCourseModalOpen(true);
  };

  const handleAddChapterField = () => {
    setChapterInputs([...chapterInputs, { name: "", teacher: "teacher1" }]);
  };

  const handleChapterFieldChange = (index, value) => {
    const updated = [...chapterInputs];
    updated[index] = { ...updated[index], name: value };
    setChapterInputs(updated);
  };

  const handleChapterFieldTeacherChange = (index, teacher) => {
    const updated = [...chapterInputs];
    updated[index] = { ...updated[index], teacher };
    setChapterInputs(updated);
  };

  const handleRemoveChapterField = (index) => {
    if (chapterInputs.length === 1) return;
    setChapterInputs(chapterInputs.filter((_, i) => i !== index));
  };

  const handleSaveNewCourse = () => {
    if (!courseNameInput.trim()) {
      alert("অনুগ্রহ করে কোর্সের নাম দাও!");
      return;
    }

    const validChapters = chapterInputs
      .map((c) => ({ name: c.name.trim(), teacher: c.teacher }))
      .filter((c) => c.name.length > 0)
      .map((c, idx) => ({
        id: `c_${Date.now()}_${idx}`,
        name: c.name,
        teacher: c.teacher,
        done: false,
        expanded: false,
        topics: [],
      }));

    const newCourse = {
      id: Date.now(),
      name: courseNameInput.trim(),
      credit: Number(courseCreditInput) || 3,
      teacher1: teacher1Input.trim(),
      teacher2: teacher2Input.trim(),
      isPinned: false,
      chapters:
        validChapters.length > 0
          ? validChapters
          : [{ id: `c_${Date.now()}`, name: "Chapter 1", teacher: "teacher1", done: false, expanded: false, topics: [] }],
      ctMarks: [],
      assignmentMark: null,
      attendanceMark: null,
    };

    const updatedList = sortCoursesWithPin([...myCourses, newCourse]);
    setMyCourses(updatedList);
    setIsCourseModalOpen(false);
  };

  // --- Add Chapter Logic ---
  const handleSaveNewChapter = () => {
    if (!addChapterModal.name.trim()) return;

    const updated = myCourses.map((c) => {
      if (c.id === addChapterModal.courseId) {
        return {
          ...c,
          chapters: [
            ...c.chapters,
            {
              id: `c_${Date.now()}`,
              name: addChapterModal.name.trim(),
              teacher: addChapterModal.teacher,
              done: false,
              expanded: false,
              topics: [],
            },
          ],
        };
      }
      return c;
    });

    setMyCourses(updated);
    setAddChapterModal({ isOpen: false, courseId: null, name: "", teacher: "teacher1" });
  };

  // --- Add Subtopic Logic ---
  const handleSaveNewTopic = () => {
    if (!addTopicModal.name.trim()) return;

    const updated = myCourses.map((c) => {
      if (c.id === addTopicModal.courseId) {
        const updatedChapters = c.chapters.map((ch) => {
          if (ch.id === addTopicModal.chapterId) {
            const newTopics = [...(ch.topics || []), { id: `t_${Date.now()}`, name: addTopicModal.name.trim(), done: false }];
            return { ...ch, expanded: true, topics: newTopics, done: false };
          }
          return ch;
        });
        return { ...c, chapters: updatedChapters };
      }
      return c;
    });

    setMyCourses(updated);
    setAddTopicModal({ isOpen: false, courseId: null, chapterId: null, name: "" });
  };

  // --- Edit / Delete Handlers ---
  const handleSaveEditChapter = () => {
    if (!editChapterModal.name.trim()) return;

    const updated = myCourses.map((c) => {
      if (c.id === editChapterModal.courseId) {
        const updatedChapters = c.chapters.map((ch) => {
          if (ch.id === editChapterModal.chapterId) {
            return { ...ch, name: editChapterModal.name.trim(), teacher: editChapterModal.teacher };
          }
          return ch;
        });
        return { ...c, chapters: updatedChapters };
      }
      return c;
    });

    setMyCourses(updated);
    setEditChapterModal({ isOpen: false, courseId: null, chapterId: null, name: "", teacher: "teacher1" });
  };

  const handleDeleteChapter = (courseId, chapterId, e) => {
    e.stopPropagation();
    if (activeTab !== "my") return;

    const updated = myCourses.map((c) => {
      if (c.id === courseId) {
        return { ...c, chapters: c.chapters.filter((ch) => ch.id !== chapterId) };
      }
      return c;
    });
    setMyCourses(updated);
  };

  const handleDeleteTopic = (courseId, chapterId, topicId) => {
    if (activeTab !== "my") return;

    const updated = myCourses.map((c) => {
      if (c.id === courseId) {
        const updatedChapters = c.chapters.map((ch) => {
          if (ch.id === chapterId) {
            const updatedTopics = ch.topics.filter((t) => t.id !== topicId);
            const allDone = updatedTopics.length > 0 && updatedTopics.every((t) => t.done);
            return { ...ch, topics: updatedTopics, done: updatedTopics.length > 0 ? allDone : ch.done };
          }
          return ch;
        });
        return { ...c, chapters: updatedChapters };
      }
      return c;
    });
    setMyCourses(updated);
  };

  // --- Marks Save Logic ---
  const handleSaveMarkModal = () => {
    const { type, courseId, ctIndex, value } = markModal;
    const numVal = value === "" ? null : Number(value);

    if (value !== "" && (isNaN(numVal) || numVal < 0)) {
      alert("সঠিক নম্বর টাইপ করো!");
      return;
    }

    const updated = myCourses.map((c) => {
      if (c.id === courseId) {
        if (type === "ct_add") {
          return { ...c, ctMarks: [...c.ctMarks, numVal] };
        } else if (type === "ct_edit") {
          const updatedCt = [...c.ctMarks];
          if (value === "") {
            updatedCt.splice(ctIndex, 1);
          } else {
            updatedCt[ctIndex] = numVal;
          }
          return { ...c, ctMarks: updatedCt };
        } else if (type === "assignment") {
          return { ...c, assignmentMark: numVal };
        } else if (type === "attendance") {
          return { ...c, attendanceMark: numVal };
        }
      }
      return c;
    });

    setMyCourses(updated);
    setMarkModal({ isOpen: false, type: "", courseId: null, ctIndex: null, value: "" });
  };

  // --- Room Create / Join Handlers ---
  const handleCreateRoom = () => {
    if (!newRoomName.trim() || !newRoomCode.trim()) {
      alert("রুমের নাম ও কোড দুটোই দিতে হবে!");
      return;
    }

    const myStats = getMyOverallStats();
    const createdRoom = {
      id: `room_${Date.now()}`,
      name: newRoomName.trim(),
      code: newRoomCode.trim().toUpperCase(),
      members: [
        {
          id: "me",
          name: `${user?.name || "আমি"} (Me)`,
          progress: myStats.progress,
          avgCt: myStats.avgCt,
          status: "Online",
        },
      ],
    };

    setRooms([...rooms, createdRoom]);
    setSelectedRoomId(createdRoom.id);
    setIsCreateRoomModalOpen(false);
    setNewRoomName("");
    setNewRoomCode("");
    alert(`🎉 "${createdRoom.name}" তৈরি হয়েছে! কোড: ${createdRoom.code}`);
  };

  const handleJoinRoom = () => {
    if (!joinRoomCodeInput.trim()) {
      alert("রুমের কোড দাও!");
      return;
    }

    const foundRoom = rooms.find(
      (r) => r.code.toLowerCase() === joinRoomCodeInput.trim().toLowerCase()
    );

    if (foundRoom) {
      setSelectedRoomId(foundRoom.id);
      setIsJoinRoomModalOpen(false);
      setJoinRoomCodeInput("");
      alert(`✅ সফলভাবে "${foundRoom.name}" স্টাডি রুমে জয়েন করেছো!`);
    } else {
      alert("⚠️ রুম কোডটি সঠিক নয়! আবার চেষ্টা করো।");
    }
  };

  // --- Login Gate: Gmail দিয়ে সাইন-ইন না করা পর্যন্ত মূল অ্যাপ দেখা যাবে না ---
  // --- Login Gate: Google দিয়ে সাইন-ইন না করা পর্যন্ত মূল অ্যাপ দেখা যাবে না ---
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#EAE7DC] flex items-center justify-center p-4">
        <p className="text-slate-400 text-sm font-medium">লোড হচ্ছে...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className="min-h-screen bg-[#EAE7DC] flex items-center justify-center p-4"
        style={{
          backgroundImage:
            "linear-gradient(rgba(30,64,90,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,90,0.07) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&display=swap');
          .font-blueprint { font-family: 'Oswald', sans-serif; letter-spacing: 0.02em; }
        `}</style>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 max-w-sm w-full p-8 text-center space-y-6">
          <div>
            <h1 className="text-2xl font-blueprint font-extrabold text-[#1E405A] tracking-tight mb-1">
              🏗️ STUDY TRACKER
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              চালিয়ে যেতে Gmail দিয়ে সাইন-ইন করো
            </p>
          </div>

          <button
            onClick={handleGoogleSignInClick}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 shadow-sm transition font-semibold text-sm text-slate-700"
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4c-7.4 0-13.8 4-17.7 10.7z"/>
              <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.4C29.6 35.4 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C10.1 39.9 16.5 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.4C41.8 36 44 30.6 44 24c0-1.2-.1-2.4-.4-3.5z"/>
            </svg>
            Sign in with Google
          </button>

          <label className="flex items-center justify-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={handleToggleRememberMe}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-500">আমাকে মনে রাখো</span>
          </label>

          <p className="text-[11px] text-slate-400">
            তোমার Gmail অ্যাকাউন্ট দিয়ে নিরাপদে সাইন-ইন হবে
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#EAE7DC] p-4 md:p-8 text-slate-800 font-sans"
      style={{
        backgroundImage:
          "linear-gradient(rgba(30,64,90,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,90,0.07) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&display=swap');
        .font-blueprint { font-family: 'Oswald', sans-serif; letter-spacing: 0.02em; }
      `}</style>
      <div className="max-w-4xl mx-auto">
        {/* Title Header */}
        <div className="text-center mb-6 relative">
          <div className="flex items-center justify-center gap-2 mb-1">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name}
                className="w-7 h-7 rounded-full object-cover border border-blue-200"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-extrabold flex items-center justify-center">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs font-semibold text-slate-500">{user.email}</span>
            {isSyncing && (
              <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                সেভ হচ্ছে...
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-[11px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-full transition"
            >
              লগ-আউট
            </button>
          </div>
          <h1 className="text-3xl md:text-4xl font-blueprint font-extrabold text-[#1E405A] mb-2 tracking-tight">
            🏗️ STUDY TRACKER
          </h1>
          <p className="text-slate-500 font-medium">
            গ্রুপ, বন্ধু এবং নিজের পড়ার অগ্রগতি ও সিলেবাস ট্র্যাক করো
          </p>
        </div>

        {/* Tab Switcher & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTab("my")}
              className={`px-5 py-2.5 rounded-xl font-bold transition-all text-xs sm:text-sm ${
                activeTab === "my"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              👷 আমার প্রগ্রেস
            </button>
            <button
              onClick={() => setActiveTab("friend")}
              className={`px-5 py-2.5 rounded-xl font-bold transition-all text-xs sm:text-sm ${
                activeTab === "friend"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              🧑‍🤝‍🧑 বন্ধুর প্রগ্রেস
            </button>
            <button
              onClick={() => setActiveTab("group")}
              className={`px-5 py-2.5 rounded-xl font-bold transition-all text-xs sm:text-sm ${
                activeTab === "group"
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-200"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              📐 গ্রুপ / স্টাডি রুম
            </button>
          </div>

          {activeTab !== "group" && (
            <button
              onClick={handleSortByCredit}
              title="ক্রেডিট অনুযায়ী আবার সাজাও"
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl border border-slate-200 shadow-sm flex items-center gap-1.5 transition"
            >
              📊 ক্রেডিট অনুযায়ী সাজাও
            </button>
          )}
        </div>

        {/* ================= GROUP / ROOM TAB CONTENT ================= */}
        {activeTab === "group" && (
          <div className="space-y-6">
            {rooms.length === 0 && (
              <div className="bg-white rounded-3xl p-10 border border-dashed border-slate-300 text-center space-y-4">
                <div className="text-3xl">🏠</div>
                <p className="text-slate-600 font-bold">এখনো কোনো স্টাডি রুমে নেই</p>
                <p className="text-slate-400 text-sm">
                  নতুন রুম তৈরি করো অথবা বন্ধুর দেওয়া কোড দিয়ে জয়েন করো
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    onClick={() => setIsCreateRoomModalOpen(true)}
                    className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-100 transition"
                  >
                    + নতুন রুম তৈরি করো
                  </button>
                  <button
                    onClick={() => setIsJoinRoomModalOpen(true)}
                    className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm transition"
                  >
                    🔑 রুমে জয়েন করো
                  </button>
                </div>
              </div>
            )}

            {rooms.length > 0 && (
              <>
            {/* Room Selector Header Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-cyan-600 uppercase tracking-wider block mb-1">
                    বর্তমান স্টাডি রুম
                  </span>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedRoomId}
                      onChange={(e) => setSelectedRoomId(e.target.value)}
                      className="text-lg md:text-xl font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          🏠 {r.name}
                        </option>
                      ))}
                    </select>
                    <span className="bg-cyan-100 text-cyan-800 text-xs font-extrabold px-3 py-1 rounded-full border border-cyan-200">
                      Code: {currentRoom?.code}
                    </span>
                  </div>
                </div>

                {/* Room Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsCreateRoomModalOpen(true)}
                    className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-100 transition"
                  >
                    + নতুন রুম তৈরি করো
                  </button>
                  <button
                    onClick={() => setIsJoinRoomModalOpen(true)}
                    className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm transition"
                  >
                    🔑 রুমে জয়েন করো
                  </button>
                </div>
              </div>
            </div>

            {/* Room Members Progress Leaderboard */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  🏆 রুমের সকল মেম্বারের প্রগ্রেস ({currentRoom?.members.length} জন)
                </h2>
                <p className="text-xs text-slate-400 font-medium">রুম কোড শেয়ার করে বন্ধুদের ইনভাইট করো</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentRoom?.members.map((member, idx) => (
                  <div
                    key={member.id || idx}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                          <span>{idx + 1}. {member.name}</span>
                        </h3>
                        <span className="text-[11px] font-medium text-slate-400">
                          স্ট্যাটাস: <strong className="text-slate-600">{member.status}</strong>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-cyan-600">
                          {member.progress}%
                        </span>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">পড়া শেষ</p>
                      </div>
                    </div>

                    {/* Member Progress Bar */}
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-cyan-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${member.progress}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-500 font-semibold pt-1 border-t border-slate-200/60">
                      <span>Best 3 CT Avg:</span>
                      <span className="text-cyan-700 font-bold bg-cyan-50 px-2.5 py-0.5 rounded-lg border border-cyan-100">
                        {member.avgCt} / 20
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
              </>
            )}
          </div>
        )}

        {/* ================= MY COURSES / FRIEND COURSES TAB ================= */}
        {activeTab !== "group" && (
          <div className="space-y-6">
            {currentCourses.length === 0 && (
              <div className="bg-white rounded-3xl p-10 border border-dashed border-slate-300 text-center space-y-2">
                <div className="text-3xl">📂</div>
                {activeTab === "my" ? (
                  <>
                    <p className="text-slate-600 font-bold">এখনো কোনো কোর্স যোগ করা হয়নি</p>
                    <p className="text-slate-400 text-sm">
                      নিচের "নতুন কোর্স যুক্ত করো" বাটনে চেপে শুরু করো
                    </p>
                  </>
                ) : (
                  <p className="text-slate-600 font-bold">এখনো কোনো বন্ধুর কোর্স শেয়ার করা হয়নি</p>
                )}
              </div>
            )}

            {currentCourses.map((course, index) => {
              const completedCount = course.chapters.filter((c) => c.done).length;
              const progressPercent =
                course.chapters.length > 0
                  ? Math.round((completedCount / course.chapters.length) * 100)
                  : 0;

              const best3Avg = getBest3Average(course.ctMarks);

              // A+ পেতে কত দরকার তার ক্যালকুলেশন
              const ctVal = parseFloat(best3Avg) || 0;
              const assignVal = course.assignmentMark !== null ? Number(course.assignmentMark) : 0;
              const attendVal = course.attendanceMark !== null ? Number(course.attendanceMark) : 0;
              const currentTotalMarks = ctVal + assignVal + attendVal;
              const neededForA = 80 - currentTotalMarks;

              return (
                <div
                  key={course.id}
                  className={`bg-white rounded-3xl p-6 shadow-sm border transition relative ${
                    course.isPinned
                      ? "border-amber-400 ring-2 ring-amber-100 shadow-amber-50"
                      : "border-slate-200 hover:shadow-md"
                  }`}
                >
                  {/* Course Header */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4 gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-blueprint font-bold text-slate-800">
                          {index + 1}. {course.name}
                        </h2>
                        {course.isPinned && (
                          <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-300">
                            📌 পিন করা
                          </span>
                        )}
                      </div>
                      <span className="inline-block mt-1.5 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-dashed border-blue-300">
                        Credit: {course.credit}
                      </span>
                      {(course.teacher1 || course.teacher2) && (
                        <span className="inline-block mt-1.5 ml-1.5 bg-cyan-50 text-cyan-700 text-xs font-bold px-3 py-1 rounded-full border border-dashed border-cyan-300">
                          👨‍🏫 {course.teacher1 || "শিক্ষক ১"} ও {course.teacher2 || "শিক্ষক ২"}
                        </span>
                      )}
                    </div>

                    {/* Header Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                        <button
                          disabled={index === 0}
                          onClick={() => handleMoveCourse(index, "up")}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-slate-600 hover:text-blue-600 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition"
                          title="উপরে তোলো"
                        >
                          ▲
                        </button>
                        <button
                          disabled={index === currentCourses.length - 1}
                          onClick={() => handleMoveCourse(index, "down")}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-slate-600 hover:text-blue-600 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition"
                          title="নিচে নামাও"
                        >
                          ▼
                        </button>
                      </div>

                      <button
                        onClick={() => handleTogglePin(course.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1 ${
                          course.isPinned
                            ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                        title={course.isPinned ? "আনপিন করো" : "উপরে পিন করো"}
                      >
                        📍 {course.isPinned ? "আনপিন" : "পিন"}
                      </button>

                      {activeTab === "my" && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenRenameCourse(course)}
                            title="কোর্সের নাম পরিবর্তন করো"
                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(course.id)}
                            title="কোর্স ডিলিট করো"
                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition"
                          >
                            🗑️
                          </button>
                        </div>
                      )}

                      <div className="text-right ml-2 hidden sm:block">
                        <span className="text-2xl font-black text-blue-600">
                          {progressPercent}%
                        </span>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">কমপ্লিট</p>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-6">
                    <div
                      className={`h-full transition-all duration-300 ${
                        activeTab === "my" ? "bg-blue-600" : "bg-emerald-600"
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>

                  {/* Course Body Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {/* Chapters & Topics List (শিক্ষক অনুযায়ী গ্রুপ করা) */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          চ্যাপ্টার ও টপিক সিলেবাস
                        </h3>
                        {activeTab === "my" && (
                          <button
                            onClick={() => setAddChapterModal({ isOpen: true, courseId: course.id, name: "", teacher: "teacher1" })}
                            className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg transition"
                          >
                            + চ্যাপ্টার
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {["teacher1", "teacher2"].map((tKey) => {
                          const teacherChapters = course.chapters.filter((c) => c.teacher === tKey);
                          const sectionKey = `${course.id}:${tKey}`;
                          const isSectionExpanded = expandedTeacherSections[sectionKey] !== false;
                          const doneCount = teacherChapters.filter((c) => c.done).length;

                          return (
                            <div key={tKey} className="border border-cyan-200 rounded-xl overflow-hidden">
                              {/* Teacher Section Header */}
                              <div
                                onClick={() => toggleTeacherSection(sectionKey)}
                                className="flex items-center justify-between gap-2 p-2.5 bg-cyan-50/70 hover:bg-cyan-50 cursor-pointer select-none"
                              >
                                <span className="text-xs font-bold text-cyan-800 flex items-center gap-1.5 min-w-0">
                                  <span className="shrink-0">👨‍🏫</span>
                                  <span className="truncate">{getTeacherLabel(course, tKey)}</span>
                                </span>
                                <span className="flex items-center gap-2 shrink-0">
                                  {teacherChapters.length > 0 && (
                                    <span className="text-[10px] font-bold text-cyan-700 bg-white px-2 py-0.5 rounded-full border border-cyan-200">
                                      {doneCount}/{teacherChapters.length}
                                    </span>
                                  )}
                                  <span className="text-cyan-400 text-xs">{isSectionExpanded ? "▲" : "▼"}</span>
                                </span>
                              </div>

                              {/* Teacher Section Body */}
                              {isSectionExpanded && (
                                <div className="p-2 space-y-2 bg-white">
                                  {teacherChapters.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic px-1 py-1.5">
                                      এই শিক্ষকের কোনো চ্যাপ্টার যোগ করা হয়নি
                                    </p>
                                  ) : (
                                    teacherChapters.map((chap) => (
                                      <div
                                        key={chap.id}
                                        className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50 hover:bg-slate-50 transition"
                                      >
                                        {/* Chapter Header Row */}
                                        <div
                                          onClick={() => toggleExpandChapter(course.id, chap.id)}
                                          className="flex items-center justify-between gap-2 p-3 cursor-pointer select-none"
                                        >
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <input
                                              type="checkbox"
                                              checked={chap.done}
                                              disabled={activeTab !== "my"}
                                              onChange={(e) => toggleChapterDone(course.id, chap.id, e)}
                                              onClick={(e) => e.stopPropagation()}
                                              className="w-5 h-5 accent-blue-600 rounded cursor-pointer shrink-0"
                                            />
                                            <span
                                              className={`text-sm font-semibold truncate min-w-0 ${
                                                chap.done ? "line-through text-slate-400" : "text-slate-700"
                                              }`}
                                            >
                                              {chap.name}
                                            </span>
                                            {chap.topics && chap.topics.length > 0 && (
                                              <span className="text-[11px] font-bold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full shrink-0">
                                                {chap.topics.filter((t) => t.done).length}/{chap.topics.length}
                                              </span>
                                            )}
                                          </div>

                                          <div className="flex items-center gap-1 shrink-0">
                                            {activeTab === "my" && (
                                              <>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditChapterModal({ isOpen: true, courseId: course.id, chapterId: chap.id, name: chap.name, teacher: chap.teacher || "teacher1" });
                                                  }}
                                                  title="এডিট করো"
                                                  className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-600 transition shrink-0"
                                                >
                                                  ✏️
                                                </button>
                                                <button
                                                  onClick={(e) => handleDeleteChapter(course.id, chap.id, e)}
                                                  title="ডিলিট করো"
                                                  className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-red-600 transition shrink-0"
                                                >
                                                  🗑️
                                                </button>
                                              </>
                                            )}
                                            <span className="text-slate-400 text-xs ml-0.5 shrink-0">
                                              {chap.expanded ? "▲" : "▼"}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Expanded Topics Section */}
                                        {chap.expanded && (
                                          <div className="bg-white p-3 border-t border-slate-100 pl-8 space-y-2">
                                            {chap.topics && chap.topics.length > 0 ? (
                                              chap.topics.map((topic) => (
                                                <div
                                                  key={topic.id}
                                                  className="flex items-center justify-between text-xs py-1 group"
                                                >
                                                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                                    <input
                                                      type="checkbox"
                                                      checked={topic.done}
                                                      disabled={activeTab !== "my"}
                                                      onChange={() => toggleTopicDone(course.id, chap.id, topic.id)}
                                                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
                                                    />
                                                    <span
                                                      className={`truncate ${
                                                        topic.done ? "line-through text-slate-400" : "text-slate-600 font-medium"
                                                      }`}
                                                    >
                                                      {topic.name}
                                                    </span>
                                                  </label>
                                                  {activeTab === "my" && (
                                                    <button
                                                      onClick={() => handleDeleteTopic(course.id, chap.id, topic.id)}
                                                      className="text-slate-300 hover:text-red-600 opacity-80 group-hover:opacity-100 transition px-1 shrink-0"
                                                    >
                                                      ✕
                                                    </button>
                                                  )}
                                                </div>
                                              ))
                                            ) : (
                                              <p className="text-[11px] text-slate-400 italic">কোনো টপিক যোগ করা হয়নি</p>
                                            )}

                                            {activeTab === "my" && (
                                              <button
                                                onClick={() =>
                                                  setAddTopicModal({
                                                    isOpen: true,
                                                    courseId: course.id,
                                                    chapterId: chap.id,
                                                    name: "",
                                                  })
                                                }
                                                className="mt-2 text-xs font-bold text-blue-600 hover:underline inline-block"
                                              >
                                                + টপিক যোগ করো
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Marks Section */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            ক্লাস টেস্ট মার্কস (Max 4)
                          </h3>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {course.ctMarks.length > 0 ? (
                            course.ctMarks.map((mark, i) => (
                              <div
                                key={i}
                                className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 shadow-sm flex items-center gap-1.5"
                              >
                                <span>
                                  CT-{i + 1}: <strong className="text-blue-600">{mark}</strong>
                                </span>
                                {activeTab === "my" && (
                                  <button
                                    onClick={() =>
                                      setMarkModal({
                                        isOpen: true,
                                        type: "ct_edit",
                                        courseId: course.id,
                                        ctIndex: i,
                                        value: String(mark),
                                      })
                                    }
                                    title="এডিট / ডিলিট করো"
                                    className="text-slate-400 hover:text-blue-600 text-[10px] ml-1"
                                  >
                                    ✏️
                                  </button>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400">কোনো CT মার্কস নেই</p>
                          )}
                        </div>

                        {activeTab === "my" && course.ctMarks.length < 4 && (
                          <button
                            onClick={() =>
                              setMarkModal({
                                isOpen: true,
                                type: "ct_add",
                                courseId: course.id,
                                ctIndex: null,
                                value: "",
                              })
                            }
                            className="w-full text-xs font-bold py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition mb-3 shadow-sm"
                          >
                            + CT মার্কস যোগ করো ({course.ctMarks.length}/4)
                          </button>
                        )}

                        {/* Best 3 Average */}
                        <div className="bg-blue-50/80 border border-blue-100 p-3.5 rounded-2xl text-center">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-500">
                            Best 3 CT Average
                          </p>
                          <p className="text-2xl font-black text-blue-600 mt-0.5">
                            {best3Avg}
                          </p>
                        </div>
                      </div>

                      {/* Assignment, Attendance & Needed For A+ Section */}
                      <div className="pt-3 border-t border-slate-200/60 space-y-2.5">
                        {/* Assignment */}
                        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              অ্যাসাইনমেন্ট
                            </span>
                            <span className="text-sm font-extrabold text-slate-800">
                              {course.assignmentMark !== null ? course.assignmentMark : "নেই"}
                            </span>
                          </div>
                          {activeTab === "my" && (
                            <button
                              onClick={() =>
                                setMarkModal({
                                  isOpen: true,
                                  type: "assignment",
                                  courseId: course.id,
                                  ctIndex: null,
                                  value: course.assignmentMark !== null ? String(course.assignmentMark) : "",
                                })
                              }
                              className="text-xs font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                            >
                              {course.assignmentMark !== null ? "✏️ এডিট" : "+ যোগ করো"}
                            </button>
                          )}
                        </div>

                        {/* Attendance */}
                        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              অ্যাটেনডেন্স (উপস্থিতি)
                            </span>
                            <span className="text-sm font-extrabold text-slate-800">
                              {course.attendanceMark !== null ? course.attendanceMark : "নেই"}
                            </span>
                          </div>
                          {activeTab === "my" && (
                            <button
                              onClick={() =>
                                setMarkModal({
                                  isOpen: true,
                                  type: "attendance",
                                  courseId: course.id,
                                  ctIndex: null,
                                  value: course.attendanceMark !== null ? String(course.attendanceMark) : "",
                                })
                              }
                              className="text-xs font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                            >
                              {course.attendanceMark !== null ? "✏️ এডিট" : "+ যোগ করো"}
                            </button>
                          )}
                        </div>

                        {/* ✨ A+ (80) পেতে কত দরকার - ক্যালকুলেশন বক্স ✨ */}
                        <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-2xl text-center shadow-sm">
                          <div className="flex items-center justify-between text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider mb-1">
                            <span>🎯 A+ (80) পেতে দরকার</span>
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                              ইনকোর্স: {currentTotalMarks.toFixed(1)}/40
                            </span>
                          </div>

                          <div className="text-2xl font-black text-emerald-700 mt-1">
                            {neededForA <= 0 ? (
                              <span className="text-emerald-600 text-xl">A+ নিশ্চিত! 🎉</span>
                            ) : (
                              <span>
                                {neededForA.toFixed(1)}{" "}
                                <span className="text-xs font-bold text-emerald-600">/ 60</span>
                              </span>
                            )}
                          </div>

                          {neededForA > 60 && (
                            <p className="text-[10px] text-red-500 font-bold mt-1">
                              ⚠️ ফাইনাল পরীক্ষা 60 নম্বরের, তাই 80 পাওয়া সম্ভব নয়!
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Course Button */}
        {activeTab === "my" && (
          <div className="mt-8 text-center">
            <button
              onClick={handleOpenCourseModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-200 transition text-sm"
            >
              + নতুন কোর্স যুক্ত করো
            </button>
          </div>
        )}
      </div>

      {/* ================= MODALS SECTION ================= */}

      {/* 1. Create Room Modal */}
      {isCreateRoomModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
              🏠 নতুন স্টাডি রুম তৈরি করো
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">রুমের নাম</label>
              <input
                type="text"
                placeholder="যেমন: CSE Batch 2026"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-medium text-slate-800 placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">রুম কোড (বন্ধুদের শেয়ার করার জন্য)</label>
              <input
                type="text"
                placeholder="যেমন: CSE2026"
                value={newRoomCode}
                onChange={(e) => setNewRoomCode(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-medium uppercase text-slate-800 placeholder-slate-400"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCreateRoomModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                বাতিল
              </button>
              <button
                onClick={handleCreateRoom}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-md shadow-cyan-100"
              >
                তৈরি করো
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Join Room Modal */}
      {isJoinRoomModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
              🔑 স্টাডি রুমে জয়েন করো
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">রুম কোড টাইপ করো</label>
              <input
                type="text"
                placeholder="যেমন: CSE2026"
                value={joinRoomCodeInput}
                onChange={(e) => setJoinRoomCodeInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-medium uppercase text-slate-800 placeholder-slate-400"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsJoinRoomModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                বাতিল
              </button>
              <button
                onClick={handleJoinRoom}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-md shadow-cyan-100"
              >
                জয়েন করো
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Add Course Modal */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-5">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
              ➕ নতুন কোর্স তৈরি করো
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">কোর্সের নাম</label>
                <input
                  type="text"
                  placeholder="যেমন: Algorithm Design"
                  value={courseNameInput}
                  onChange={(e) => setCourseNameInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">কোর্স ক্রেডিট</label>
                <input
                  type="number"
                  placeholder="3"
                  value={courseCreditInput}
                  onChange={(e) => setCourseCreditInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800 placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">👨‍🏫 শিক্ষক ১</label>
                  <input
                    type="text"
                    placeholder="যেমন: Dr. Rahman"
                    value={teacher1Input}
                    onChange={(e) => setTeacher1Input(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium text-slate-800 placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">👨‍🏫 শিক্ষক ২</label>
                  <input
                    type="text"
                    placeholder="যেমন: Dr. Karim"
                    value={teacher2Input}
                    onChange={(e) => setTeacher2Input(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium text-slate-800 placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-500">চ্যাপ্টারগুলোর নাম (কোন শিক্ষক পড়াবেন সিলেক্ট করো)</label>
                  <button
                    onClick={handleAddChapterField}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    + আরও চ্যাপ্টার
                  </button>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {chapterInputs.map((ch, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder={`চ্যাপ্টার ${idx + 1}`}
                        value={ch.name}
                        onChange={(e) => handleChapterFieldChange(idx, e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium text-slate-800 placeholder-slate-400"
                      />
                      <div className="flex bg-slate-100 rounded-lg p-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleChapterFieldTeacherChange(idx, "teacher1")}
                          className={`px-2 py-1.5 rounded-md text-[10px] font-bold transition ${
                            ch.teacher === "teacher1" ? "bg-cyan-600 text-white" : "text-slate-500"
                          }`}
                        >
                          {teacher1Input.trim() || "শিক্ষক ১"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChapterFieldTeacherChange(idx, "teacher2")}
                          className={`px-2 py-1.5 rounded-md text-[10px] font-bold transition ${
                            ch.teacher === "teacher2" ? "bg-cyan-600 text-white" : "text-slate-500"
                          }`}
                        >
                          {teacher2Input.trim() || "শিক্ষক ২"}
                        </button>
                      </div>
                      {chapterInputs.length > 1 && (
                        <button
                          onClick={() => handleRemoveChapterField(idx)}
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold shrink-0"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsCourseModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100"
              >
                বাতিল
              </button>
              <button
                onClick={handleSaveNewCourse}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100"
              >
                কোর্স সেভ করো
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Add Single Chapter Modal */}
      {addChapterModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              📖 নতুন চ্যাপ্টার যুক্ত করো
            </h3>
            <input
              type="text"
              placeholder="চ্যাপ্টারের নাম..."
              value={addChapterModal.name}
              onChange={(e) => setAddChapterModal({ ...addChapterModal, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800 placeholder-slate-400"
            />
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">কোন শিক্ষক পড়াবেন?</label>
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                {["teacher1", "teacher2"].map((tKey) => {
                  const modalCourse = myCourses.find((c) => c.id === addChapterModal.courseId);
                  return (
                    <button
                      key={tKey}
                      type="button"
                      onClick={() => setAddChapterModal({ ...addChapterModal, teacher: tKey })}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                        addChapterModal.teacher === tKey ? "bg-cyan-600 text-white shadow-sm" : "text-slate-500"
                      }`}
                    >
                      👨‍🏫 {modalCourse ? getTeacherLabel(modalCourse, tKey) : tKey === "teacher1" ? "শিক্ষক ১" : "শিক্ষক ২"}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAddChapterModal({ isOpen: false, courseId: null, name: "", teacher: "teacher1" })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                বাতিল
              </button>
              <button
                onClick={handleSaveNewChapter}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                যোগ করো
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Add Subtopic Modal */}
      {addTopicModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              📌 চ্যাপ্টারের ভেতরে টপিক যোগ করো
            </h3>
            <input
              type="text"
              placeholder="টপিকের নাম..."
              value={addTopicModal.name}
              onChange={(e) => setAddTopicModal({ ...addTopicModal, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800 placeholder-slate-400"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAddTopicModal({ isOpen: false, courseId: null, chapterId: null, name: "" })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                বাতিল
              </button>
              <button
                onClick={handleSaveNewTopic}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                যোগ করো
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Edit Chapter Modal */}
      {editChapterModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              ✏️ চ্যাপ্টারের নাম পরিবর্তন করো
            </h3>
            <input
              type="text"
              value={editChapterModal.name}
              onChange={(e) => setEditChapterModal({ ...editChapterModal, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800 placeholder-slate-400"
            />
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">কোন শিক্ষক পড়াবেন?</label>
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                {["teacher1", "teacher2"].map((tKey) => {
                  const modalCourse = myCourses.find((c) => c.id === editChapterModal.courseId);
                  return (
                    <button
                      key={tKey}
                      type="button"
                      onClick={() => setEditChapterModal({ ...editChapterModal, teacher: tKey })}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                        editChapterModal.teacher === tKey ? "bg-cyan-600 text-white shadow-sm" : "text-slate-500"
                      }`}
                    >
                      👨‍🏫 {modalCourse ? getTeacherLabel(modalCourse, tKey) : tKey === "teacher1" ? "শিক্ষক ১" : "শিক্ষক ২"}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditChapterModal({ isOpen: false, courseId: null, chapterId: null, name: "", teacher: "teacher1" })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                বাতিল
              </button>
              <button
                onClick={handleSaveEditChapter}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                সেভ করো
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Marks Modal */}
      {markModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              🎯 নম্বর বসাও / আপডেট করো
            </h3>
            <input
              type="number"
              placeholder="নম্বর টাইপ করো..."
              value={markModal.value}
              onChange={(e) => setMarkModal({ ...markModal, value: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800 placeholder-slate-400"
            />
            <p className="text-[11px] text-slate-400">
              * নম্বর মুছে ফেলতে বক্স খালি রেখে সেভ দাও
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setMarkModal({ isOpen: false, type: "", courseId: null, ctIndex: null, value: "" })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                বাতিল
              </button>
              <button
                onClick={handleSaveMarkModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                সেভ করো
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Rename Course Modal */}
      {renameCourseModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              ✏️ কোর্সের তথ্য পরিবর্তন করো
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">কোর্সের নাম</label>
              <input
                type="text"
                value={renameCourseModal.name}
                onChange={(e) => setRenameCourseModal({ ...renameCourseModal, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800 placeholder-slate-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">👨‍🏫 শিক্ষক ১</label>
                <input
                  type="text"
                  placeholder="যেমন: Dr. Rahman"
                  value={renameCourseModal.teacher1}
                  onChange={(e) => setRenameCourseModal({ ...renameCourseModal, teacher1: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium text-slate-800 placeholder-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">👨‍🏫 শিক্ষক ২</label>
                <input
                  type="text"
                  placeholder="যেমন: Dr. Karim"
                  value={renameCourseModal.teacher2}
                  onChange={(e) => setRenameCourseModal({ ...renameCourseModal, teacher2: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRenameCourseModal({ isOpen: false, courseId: null, name: "", teacher1: "", teacher2: "" })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                বাতিল
              </button>
              <button
                onClick={handleSaveRenameCourse}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                সেভ করো
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Watermark */}
      <div className="fixed bottom-3 right-3 z-40 pointer-events-none select-none">
        <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-sm border border-slate-200/70 rounded-full pl-2 pr-3 py-1 shadow-sm">
          <span className="text-[13px]">🏗️</span>
          <span className="text-[10px] font-semibold text-slate-400 tracking-wide">
            Made by Akib · Civil'24, RUET
          </span>
        </div>
      </div>
    </div>
  );
}
