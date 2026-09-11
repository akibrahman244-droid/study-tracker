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

  // --- "Remember Me" Logic ---
  // NextAuth remembers the login for ~30 days by default. If "Remember Me" is unchecked,
  // closing the browser completely and reopening it (new session) will automatically log out.
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
  // --- Settings: Dark mode, how courses appear on app open, settings panel ---
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [restoreLastState, setRestoreLastState] = useState(true); // true = restore as you left it, false = always minimized

  // --- Language: toggle between English and Bangla (bottom-right button) ---
  const [lang, setLang] = useState("en");
  useEffect(() => {
    const savedLang = localStorage.getItem("studyTracker:lang");
    if (savedLang === "en" || savedLang === "bn") setLang(savedLang);
  }, []);
  const handleToggleLang = () => {
    const next = lang === "en" ? "bn" : "en";
    setLang(next);
    localStorage.setItem("studyTracker:lang", next);
  };
  const [clearDataModal, setClearDataModal] = useState({ isOpen: false, step: "confirm", selected: {} });

  // --- Generic confirmation modal (shown before deleting anything) ---
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: null });
  const openConfirmModal = (title, message, onConfirm) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };
  const closeConfirmModal = () => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null });
  const handleConfirmModalYes = () => {
    if (confirmModal.onConfirm) confirmModal.onConfirm();
    closeConfirmModal();
  };

  // --- Course card three-dot menu (pin/edit/delete together) ---
  const [openCourseMenuId, setOpenCourseMenuId] = useState(null);

  // --- Undo system: remember the previous state before any change to myCourses/friendCourses ---
  const undoStackRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const pushUndoSnapshot = () => {
    undoStackRef.current.push({ myCourses, friendCourses });
    if (undoStackRef.current.length > 25) undoStackRef.current.shift();
    setCanUndo(true);
  };
  const updateMyCourses = (newList) => {
    pushUndoSnapshot();
    setMyCourses(newList);
  };
  const updateFriendCourses = (newList) => {
    pushUndoSnapshot();
    setFriendCourses(newList);
  };
  const handleUndo = () => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const last = stack.pop();
    setMyCourses(last.myCourses);
    setFriendCourses(last.friendCourses);
    setCanUndo(stack.length > 0);
  };

  // Apply immediately if saved in the browser (before data arrives from the server), to avoid a flash
  useEffect(() => {
    const savedDark = localStorage.getItem("studyTracker:darkMode");
    if (savedDark !== null) setDarkMode(savedDark === "true");
    const savedRestore = localStorage.getItem("studyTracker:restoreLastState");
    if (savedRestore !== null) setRestoreLastState(savedRestore === "true");
  }, []);

  const handleToggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("studyTracker:darkMode", String(next));
  };

  const handleSetRestoreLastState = (value) => {
    setRestoreLastState(value);
    localStorage.setItem("studyTracker:restoreLastState", String(value));
  };


  // Helper function to sort by credit (pinned courses on top, then by higher credit)
  const sortCoursesWithPin = (list) => {
    return [...list].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.credit - a.credit;
    });
  };

  // My courses data
  const [myCourses, setMyCourses] = useState([]);

  // Friend's courses data
  const [friendCourses, setFriendCourses] = useState([]);

  // --- Study room / group state ---
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  // --- Save/load user data (by Gmail, in this browser) ---
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
            const loadedRestore = data.settings?.restoreLastState ?? true;
            const applyCardState = (list) =>
              (list || []).map((c) => ({
                ...c,
                cardExpanded: loadedRestore ? c.cardExpanded !== false : false,
              }));
            setMyCourses(applyCardState(data.myCourses));
            setFriendCourses(applyCardState(data.friendCourses));
            setRooms(data.rooms || []);
            setSelectedRoomId(data.selectedRoomId ?? null);
            if (data.settings) {
              if (typeof data.settings.darkMode === "boolean") {
                setDarkMode(data.settings.darkMode);
                localStorage.setItem("studyTracker:darkMode", String(data.settings.darkMode));
              }
              if (typeof data.settings.restoreLastState === "boolean") {
                setRestoreLastState(data.settings.restoreLastState);
                localStorage.setItem("studyTracker:restoreLastState", String(data.settings.restoreLastState));
              }
            }
          } else {
            setMyCourses([]);
            setFriendCourses([]);
            setRooms([]);
            setSelectedRoomId(null);
          }
        }
      } catch (e) {
        // If there is a network issue, data won't load, but it stays saved on the server and isn't lost
      }
      setDataLoaded(true);
    })();
  }, [user?.email]);

  useEffect(() => {
    if (!dataLoaded || !currentEmailRef.current) return;
    const payload = {
      myCourses,
      friendCourses,
      rooms,
      selectedRoomId,
      settings: { darkMode, restoreLastState },
    };
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
  }, [myCourses, friendCourses, rooms, selectedRoomId, dataLoaded, darkMode, restoreLastState]);

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

  // State for opening/closing the teacher-based section (teacher1/teacher2) in each course
  const [expandedTeacherSections, setExpandedTeacherSections] = useState({});
  const toggleTeacherSection = (key) => {
    setExpandedTeacherSections((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  };

  const currentCourses = activeTab === "my" ? myCourses : friendCourses;
  const currentRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0];

  // Average of the best 3 out of 4 CTs (Best 3 of 4)
  const getBest3Average = (marks) => {
    if (!marks || marks.length === 0) return "0.0";
    const sorted = [...marks].sort((a, b) => b - a);
    const best3 = sorted.slice(0, 3);
    const sum = best3.reduce((acc, curr) => acc + curr, 0);
    return (sum / best3.length).toFixed(1);
  };

  // Calculate overall progress % and average CT from all own courses (for display in the study room)
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

  // Get the actual teacher name from the chapter's teacher key ("teacher1"/"teacher2")
  const getTeacherLabel = (course, teacherKey) => {
    if (teacherKey === "teacher2") return course.teacher2 && course.teacher2.trim() ? course.teacher2 : (lang === "bn" ? "শিক্ষক ২" : "Teacher 2");
    return course.teacher1 && course.teacher1.trim() ? course.teacher1 : (lang === "bn" ? "শিক্ষক ১" : "Teacher 1");
  };

  // --- Course Pin & Shuffle Handlers ---
  const handleTogglePin = (courseId) => {
    const targetCourses = activeTab === "my" ? myCourses : friendCourses;
    const updated = targetCourses.map((c) =>
      c.id === courseId ? { ...c, isPinned: !c.isPinned } : c
    );

    const sorted = sortCoursesWithPin(updated);

    if (activeTab === "my") updateMyCourses(sorted);
    else updateFriendCourses(sorted);
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
    const target = myCourses.find((c) => c.id === courseId);
    openConfirmModal(
      lang === "bn" ? "🗑️ কোর্স ডিলিট করো" : "🗑️ Delete Course",
      lang === "bn" ? `তুমি কি নিশ্চিত "${target?.name || "এই কোর্সটি"}" ডিলিট করতে চাও? পরে চাইলে Undo বাটন দিয়ে ফিরিয়ে আনতে পারবে।` : `Are you sure you want to delete "${target?.name || "this course"}"? You can restore it later using the Undo button.`,
      () => {
        const updated = myCourses.filter((c) => c.id !== courseId);
        updateMyCourses(updated);
      }
    );
  };

  // --- Clear All Data ---
  const handleOpenClearDataModal = () => {
    setClearDataModal({ isOpen: true, step: "confirm", selected: {} });
  };

  const handleClearAllCourses = () => {
    openConfirmModal(
      lang === "bn" ? "🗑️ সব কোর্স ডিলিট করো" : "🗑️ Delete All Courses",
      lang === "bn" ? "তুমি কি নিশ্চিত? তোমার সব কোর্স চিরতরে মুছে যাবে! (Undo বাটন দিয়ে ফিরিয়ে আনা যাবে)" : "Are you sure? All your courses will be permanently deleted! (Can be restored with the Undo button)",
      () => {
        updateMyCourses([]);
        setClearDataModal({ isOpen: false, step: "confirm", selected: {} });
      }
    );
  };

  const handleGoToSelectDelete = () => {
    setClearDataModal({ isOpen: true, step: "select", selected: {} });
  };

  const handleToggleSelectCourseForDelete = (courseId) => {
    setClearDataModal((prev) => ({
      ...prev,
      selected: { ...prev.selected, [courseId]: !prev.selected[courseId] },
    }));
  };

  const handleDeleteSelectedCourses = () => {
    const idsToDelete = Object.keys(clearDataModal.selected).filter((id) => clearDataModal.selected[id]);
    if (idsToDelete.length === 0) {
      alert(lang === "bn" ? "অন্তত একটা কোর্স সিলেক্ট করো!" : "Please select at least one course!");
      return;
    }
    openConfirmModal(
      lang === "bn" ? "🗑️ নির্বাচিত কোর্স ডিলিট করো" : "🗑️ Delete Selected Courses",
      lang === "bn" ? `নির্বাচিত ${idsToDelete.length} টা কোর্স মুছে ফেলতে চাও? (Undo বাটন দিয়ে ফিরিয়ে আনা যাবে)` : `Delete the ${idsToDelete.length} selected course(s)? (Can be restored with the Undo button)`,
      () => {
        const updated = myCourses.filter((c) => !idsToDelete.includes(String(c.id)));
        updateMyCourses(updated);
        setClearDataModal({ isOpen: false, step: "confirm", selected: {} });
      }
    );
  };

  const handleMoveCourse = (index, direction) => {
    const targetCourses = activeTab === "my" ? myCourses : friendCourses;
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= targetCourses.length) return;

    const updated = [...targetCourses];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    if (activeTab === "my") updateMyCourses(updated);
    else updateFriendCourses(updated);
  };

  const handleSortByCredit = () => {
    const targetCourses = activeTab === "my" ? myCourses : friendCourses;
    const sorted = sortCoursesWithPin(targetCourses);

    if (activeTab === "my") updateMyCourses(sorted);
    else updateFriendCourses(sorted);
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

  // --- Course card minimize/expand toggle ---
  const toggleCourseCard = (courseId) => {
    const updated = currentCourses.map((c) =>
      c.id === courseId ? { ...c, cardExpanded: c.cardExpanded === false ? true : false } : c
    );
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
      alert(lang === "bn" ? "অনুগ্রহ করে কোর্সের নাম দাও!" : "Please enter a course name!");
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
      cardExpanded: true,
      chapters:
        validChapters.length > 0
          ? validChapters
          : [{ id: `c_${Date.now()}`, name: "Chapter 1", teacher: "teacher1", done: false, expanded: false, topics: [] }],
      ctMarks: [],
      assignmentMark: null,
      attendanceMark: null,
    };

    const updatedList = sortCoursesWithPin([...myCourses, newCourse]);
    updateMyCourses(updatedList);
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

    updateMyCourses(updated);
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

    updateMyCourses(updated);
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

    updateMyCourses(updated);
    setEditChapterModal({ isOpen: false, courseId: null, chapterId: null, name: "", teacher: "teacher1" });
  };

  const handleDeleteChapter = (courseId, chapterId, e) => {
    e.stopPropagation();
    if (activeTab !== "my") return;

    const course = myCourses.find((c) => c.id === courseId);
    const chapter = course?.chapters.find((ch) => ch.id === chapterId);
    openConfirmModal(
      lang === "bn" ? "🗑️ চ্যাপ্টার ডিলিট করো" : "🗑️ Delete Chapter",
      lang === "bn" ? `তুমি কি নিশ্চিত "${chapter?.name || "এই চ্যাপ্টার"}" ডিলিট করতে চাও? এর ভেতরের সব টপিকও মুছে যাবে।` : `Are you sure you want to delete "${chapter?.name || "this chapter"}"? All topics inside it will also be deleted.`,
      () => {
        const updated = myCourses.map((c) => {
          if (c.id === courseId) {
            return { ...c, chapters: c.chapters.filter((ch) => ch.id !== chapterId) };
          }
          return c;
        });
        updateMyCourses(updated);
      }
    );
  };

  const handleDeleteTopic = (courseId, chapterId, topicId) => {
    if (activeTab !== "my") return;

    openConfirmModal(
      lang === "bn" ? "🗑️ টপিক ডিলিট করো" : "🗑️ Delete Topic",
      lang === "bn" ? "তুমি কি নিশ্চিত এই টপিকটি ডিলিট করতে চাও?" : "Are you sure you want to delete this topic?",
      () => {
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
        updateMyCourses(updated);
      }
    );
  };

  // --- Marks Save Logic ---
  const handleSaveMarkModal = () => {
    const { type, courseId, ctIndex, value } = markModal;
    const numVal = value === "" ? null : Number(value);

    if (value !== "" && (isNaN(numVal) || numVal < 0)) {
      alert(lang === "bn" ? "সঠিক নম্বর টাইপ করো!" : "Please enter a valid number!");
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
      alert(lang === "bn" ? "রুমের নাম ও কোড দুটোই দিতে হবে!" : "Both room name and code are required!");
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
          name: `${user?.name || (lang === "bn" ? "আমি" : "Me")} (Me)`,
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
    alert(lang === "bn" ? `🎉 "${createdRoom.name}" তৈরি হয়েছে! কোড: ${createdRoom.code}` : `🎉 "${createdRoom.name}" has been created! Code: ${createdRoom.code}`);
  };

  const handleJoinRoom = () => {
    if (!joinRoomCodeInput.trim()) {
      alert(lang === "bn" ? "রুমের কোড দাও!" : "Please enter a room code!");
      return;
    }

    const foundRoom = rooms.find(
      (r) => r.code.toLowerCase() === joinRoomCodeInput.trim().toLowerCase()
    );

    if (foundRoom) {
      setSelectedRoomId(foundRoom.id);
      setIsJoinRoomModalOpen(false);
      setJoinRoomCodeInput("");
      alert(lang === "bn" ? `✅ সফলভাবে "${foundRoom.name}" স্টাডি রুমে জয়েন করেছো!` : `✅ Successfully joined the study room "${foundRoom.name}"!`);
    } else {
      alert(lang === "bn" ? "⚠️ রুম কোডটি সঠিক নয়! আবার চেষ্টা করো।" : "⚠️ The room code is incorrect! Please try again.");
    }
  };

  // --- Login Gate: the main app won't be visible until signed in with Gmail ---
  // --- Login Gate: the main app won't be visible until signed in with Google ---
  if (status === "loading") {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#EAE7DC] flex items-center justify-center p-4">
        <p className="text-slate-400 text-sm font-medium">{lang === "bn" ? "লোড হচ্ছে..." : "Loading..."}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className="min-h-screen min-h-[100dvh] bg-[#EAE7DC] flex items-center justify-center p-4"
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
              {lang === "bn" ? "চালিয়ে যেতে Gmail দিয়ে সাইন-ইন করো" : "Sign in with Gmail to continue"}
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
            <span className="text-xs font-semibold text-slate-500">{lang === "bn" ? "আমাকে মনে রাখো" : "Remember Me"}</span>
          </label>

          <p className="text-[11px] text-slate-400">
            {lang === "bn" ? "তোমার Gmail অ্যাকাউন্ট দিয়ে নিরাপদে সাইন-ইন হবে" : "You'll be securely signed in with your Gmail account"}
          </p>
        </div>

        {/* Language Toggle Button (bottom-right) */}
        <div className="fixed bottom-14 [bottom:calc(3.5rem+env(safe-area-inset-bottom))] right-3 z-40">
          <button
            onClick={handleToggleLang}
            className="flex items-center gap-1.5 backdrop-blur-sm border rounded-full pl-2.5 pr-3.5 py-2 shadow-md transition bg-white/90 border-slate-200/70 hover:bg-white"
            title={lang === "bn" ? "Switch to English" : "বাংলায় পরিবর্তন করো"}
          >
            <span className="text-base">🌐</span>
            <span className="text-[11px] font-bold text-slate-500">
              {lang === "bn" ? "EN" : "বাং"}
            </span>
          </button>
        </div>

        {/* Signature Watermark */}
        <div className="fixed bottom-3 [bottom:calc(0.75rem+env(safe-area-inset-bottom))] right-3 z-40 pointer-events-none select-none">
          <div className="flex items-center gap-1.5 backdrop-blur-sm border rounded-full pl-2 pr-3 py-1 shadow-sm bg-white/70 border-slate-200/70">
            <span className="text-[13px]">🏗️</span>
            <span className="text-[10px] font-semibold tracking-wide text-slate-400">
              Made by Akib · Civil'24, RUET
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen min-h-[100dvh] w-full overflow-x-hidden ${darkMode ? "dark-theme" : ""} p-4 md:p-8 text-slate-800 font-sans`}
      style={{
        backgroundColor: darkMode ? "#151a22" : "#EAE7DC",
        backgroundImage: darkMode
          ? "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)"
          : "linear-gradient(rgba(30,64,90,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,90,0.07) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&display=swap');
        .font-blueprint { font-family: 'Oswald', sans-serif; letter-spacing: 0.02em; }

        /* ---- Dark Mode Overrides ---- */
        .dark-theme .bg-white { background-color: #1e2530 !important; }
        .dark-theme .bg-slate-50 { background-color: #202836 !important; }
        .dark-theme .bg-slate-50\/50 { background-color: #202836 !important; }
        .dark-theme .bg-slate-100 { background-color: #29323f !important; }
        .dark-theme .bg-slate-200 { background-color: #333e4e !important; }
        .dark-theme .bg-slate-200\/60 { background-color: #333e4e99 !important; }
        .dark-theme .text-slate-800 { color: #e9ecf2 !important; }
        .dark-theme .text-slate-700 { color: #d7dbe3 !important; }
        .dark-theme .text-slate-600 { color: #c3c9d4 !important; }
        .dark-theme .text-slate-500 { color: #a3abbb !important; }
        .dark-theme .text-slate-400 { color: #7c8598 !important; }
        .dark-theme .text-slate-300 { color: #626c7e !important; }
        .dark-theme .border-slate-100 { border-color: #313a49 !important; }
        .dark-theme .border-slate-200 { border-color: #3a4557 !important; }
        .dark-theme .border-slate-200\/60 { border-color: #3a4557 !important; }
        .dark-theme .border-slate-200\/70 { border-color: #3a4557 !important; }
        .dark-theme .border-slate-300 { border-color: #48546a !important; }
        .dark-theme .bg-slate-900\/40 { background-color: rgba(0,0,0,0.6) !important; }
        .dark-theme input, .dark-theme select { background-color: #202836 !important; color: #e9ecf2 !important; }

        /* --- These three used to stay white even in dark mode (settings/undo buttons, signature) --- */
        .dark-theme .bg-white\/90 { background-color: rgba(30,37,48,0.9) !important; }
        .dark-theme .bg-white\/70 { background-color: rgba(30,37,48,0.7) !important; }
        .dark-theme .hover\:bg-white:hover { background-color: #1e2530 !important; }

        /* --- Toggle switch off-state, otherwise it looks pale white in dark mode --- */
        .dark-theme .bg-slate-300 { background-color: #48546a !important; }

        /* --- "STUDY TRACKER" heading, previously barely visible in dark navy on dark bg --- */
        .dark-theme .text-\[\#1E405A\] { color: #bde4e8 !important; }

        /* --- Muted accent palette (for eye comfort) --- */
        /* Blue / Indigo */
        .dark-theme .bg-blue-50 { background-color: rgba(99,102,241,0.14) !important; }
        .dark-theme .bg-blue-50\/80 { background-color: rgba(99,102,241,0.14) !important; }
        .dark-theme .bg-blue-100 { background-color: rgba(99,102,241,0.20) !important; }
        .dark-theme .text-blue-950 { color: #c7d2fe !important; }
        .dark-theme .text-blue-800 { color: #a5b4fc !important; }
        .dark-theme .text-blue-700 { color: #a5b4fc !important; }
        .dark-theme .text-blue-600 { color: #93a0fa !important; }
        .dark-theme .text-blue-500 { color: #8b93f8 !important; }
        .dark-theme .bg-blue-500 { background-color: #5b57d6 !important; }
        .dark-theme .bg-blue-600 { background-color: #554fce !important; }
        .dark-theme .bg-blue-700 { background-color: #453fb0 !important; }
        .dark-theme .ring-blue-500 { --tw-ring-color: rgba(99,102,241,0.45) !important; }
        .dark-theme .border-blue-100 { border-color: rgba(99,102,241,0.25) !important; }
        .dark-theme .border-blue-200 { border-color: rgba(99,102,241,0.35) !important; }
        .dark-theme .border-blue-300 { border-color: rgba(99,102,241,0.45) !important; }
        .dark-theme .shadow-blue-100 { --tw-shadow-color: rgba(99,102,241,0.15) !important; }
        .dark-theme .shadow-blue-200 { --tw-shadow-color: rgba(99,102,241,0.18) !important; }

        /* Cyan / Teal */
        .dark-theme .bg-cyan-50 { background-color: rgba(45,212,191,0.14) !important; }
        .dark-theme .bg-cyan-50\/70 { background-color: rgba(45,212,191,0.14) !important; }
        .dark-theme .bg-cyan-100 { background-color: rgba(45,212,191,0.20) !important; }
        .dark-theme .text-cyan-800 { color: #7dd3c8 !important; }
        .dark-theme .text-cyan-700 { color: #5eeada !important; }
        .dark-theme .text-cyan-600 { color: #5eeada !important; }
        .dark-theme .text-cyan-400 { color: #5eeada !important; }
        .dark-theme .bg-cyan-600 { background-color: #14a693 !important; }
        .dark-theme .bg-cyan-700 { background-color: #0e8a7a !important; }
        .dark-theme .ring-cyan-500 { --tw-ring-color: rgba(45,212,191,0.45) !important; }
        .dark-theme .border-cyan-100 { border-color: rgba(45,212,191,0.25) !important; }
        .dark-theme .border-cyan-200 { border-color: rgba(45,212,191,0.35) !important; }
        .dark-theme .border-cyan-300 { border-color: rgba(45,212,191,0.45) !important; }
        .dark-theme .shadow-cyan-100 { --tw-shadow-color: rgba(45,212,191,0.15) !important; }
        .dark-theme .shadow-cyan-200 { --tw-shadow-color: rgba(45,212,191,0.18) !important; }

        /* Green / Mint (success) */
        .dark-theme .bg-emerald-50 { background-color: rgba(52,211,153,0.14) !important; }
        .dark-theme .bg-emerald-50\/80 { background-color: rgba(52,211,153,0.14) !important; }
        .dark-theme .bg-emerald-100 { background-color: rgba(52,211,153,0.20) !important; }
        .dark-theme .text-emerald-800 { color: #86efc0 !important; }
        .dark-theme .text-emerald-700 { color: #6de6ab !important; }
        .dark-theme .text-emerald-600 { color: #6de6ab !important; }
        .dark-theme .bg-emerald-600 { background-color: #14a077 !important; }
        .dark-theme .shadow-emerald-200 { --tw-shadow-color: rgba(52,211,153,0.18) !important; }
        .dark-theme .border-emerald-200 { border-color: rgba(52,211,153,0.35) !important; }

        /* Gold / Amber (pin) */
        .dark-theme .bg-amber-100 { background-color: rgba(245,158,11,0.20) !important; }
        .dark-theme .text-amber-800 { color: #fbd48a !important; }
        .dark-theme .text-amber-700 { color: #fbd48a !important; }
        .dark-theme .border-amber-300 { border-color: rgba(245,158,11,0.4) !important; }
        .dark-theme .border-amber-400 { border-color: rgba(245,158,11,0.55) !important; }
        .dark-theme .shadow-amber-50 { --tw-shadow-color: rgba(245,158,11,0.12) !important; }
        .dark-theme .ring-amber-100 { --tw-ring-color: rgba(245,158,11,0.22) !important; }

        /* Red / Coral (delete, negative) */
        .dark-theme .bg-red-50 { background-color: rgba(251,113,133,0.14) !important; }
        .dark-theme .bg-red-100 { background-color: rgba(251,113,133,0.20) !important; }
        .dark-theme .text-red-400 { color: #fda4af !important; }
        .dark-theme .text-red-500 { color: #fb7185 !important; }
        .dark-theme .text-red-600 { color: #fb7185 !important; }
        .dark-theme .text-red-700 { color: #fda4af !important; }
        .dark-theme .bg-red-600 { background-color: #c94a63 !important; }
        .dark-theme .bg-red-700 { background-color: #a83a50 !important; }
        .dark-theme .shadow-red-100 { --tw-shadow-color: rgba(251,113,133,0.15) !important; }
        .dark-theme .border-red-200 { border-color: rgba(251,113,133,0.35) !important; }
      `}</style>
      <div className="max-w-4xl mx-auto">
        {/* Title Header */}
        <div className="text-center mb-6 relative">
          {isSyncing && (
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                {lang === "bn" ? "সেভ হচ্ছে..." : "Saving..."}
              </span>
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-blueprint font-extrabold text-[#bde4e8] mb-2 tracking-tight">
            🏗️ STUDY TRACKER
          </h1>
          <p className="text-slate-500 font-medium">
            {lang === "bn" ? "গ্রুপ, বন্ধু এবং নিজের পড়ার অগ্রগতি ও সিলেবাস ট্র্যাক করো" : "Track your group, friends, and your own study progress and syllabus"}
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
              {lang === "bn" ? "👷 আমার প্রগ্রেস" : "👷 My Progress"}
            </button>
            <button
              onClick={() => setActiveTab("friend")}
              className={`px-5 py-2.5 rounded-xl font-bold transition-all text-xs sm:text-sm ${
                activeTab === "friend"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {lang === "bn" ? "🧑‍🤝‍🧑 বন্ধুর প্রগ্রেস" : "🧑‍🤝‍🧑 Friend's Progress"}
            </button>
            <button
              onClick={() => setActiveTab("group")}
              className={`px-5 py-2.5 rounded-xl font-bold transition-all text-xs sm:text-sm ${
                activeTab === "group"
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-200"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {lang === "bn" ? "📐 গ্রুপ / স্টাডি রুম" : "📐 Group / Study Room"}
            </button>
          </div>

          {(activeTab !== "group" || activeTab === "my") && (
            <div className="flex items-center gap-2 flex-wrap">
              {activeTab !== "group" && (
                <button
                  onClick={handleSortByCredit}
                  title={lang === "bn" ? "ক্রেডিট অনুযায়ী আবার সাজাও" : "Sort again by credit"}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl border border-slate-200 shadow-sm flex items-center gap-1.5 transition"
                >
                  {lang === "bn" ? "📊 ক্রেডিট অনুযায়ী সাজাও" : "📊 Sort by Credit"}
                </button>
              )}
              {activeTab === "my" && (
                <button
                  onClick={handleOpenCourseModal}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-sm shadow-blue-200 flex items-center gap-1.5 transition"
                >
                  {lang === "bn" ? "+ নতুন কোর্স" : "+ Add New Course"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ================= GROUP / ROOM TAB CONTENT ================= */}
        {activeTab === "group" && (
          <div className="space-y-6">
            {rooms.length === 0 && (
              <div className="bg-white rounded-3xl p-10 border border-dashed border-slate-300 text-center space-y-4">
                <div className="text-3xl">🏠</div>
                <p className="text-slate-600 font-bold">{lang === "bn" ? "এখনো কোনো স্টাডি রুমে নেই" : "Not in a study room yet"}</p>
                <p className="text-slate-400 text-sm">
                  {lang === "bn" ? "নতুন রুম তৈরি করো অথবা বন্ধুর দেওয়া কোড দিয়ে জয়েন করো" : "Create a new room or join using a code from a friend"}
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    onClick={() => setIsCreateRoomModalOpen(true)}
                    className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-100 transition"
                  >
                    {lang === "bn" ? "+ নতুন রুম তৈরি করো" : "+ Create New Room"}
                  </button>
                  <button
                    onClick={() => setIsJoinRoomModalOpen(true)}
                    className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm transition"
                  >
                    {lang === "bn" ? "🔑 রুমে জয়েন করো" : "🔑 Join Room"}
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
                    {lang === "bn" ? "বর্তমান স্টাডি রুম" : "Current Study Room"}
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
                    {lang === "bn" ? "+ নতুন রুম তৈরি করো" : "+ Create New Room"}
                  </button>
                  <button
                    onClick={() => setIsJoinRoomModalOpen(true)}
                    className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm transition"
                  >
                    {lang === "bn" ? "🔑 রুমে জয়েন করো" : "🔑 Join Room"}
                  </button>
                </div>
              </div>
            </div>

            {/* Room Members Progress Leaderboard */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  {lang === "bn" ? `🏆 রুমের সকল মেম্বারের প্রগ্রেস (${currentRoom?.members.length} জন)` : `🏆 Progress of All Room Members (${currentRoom?.members.length} members)`}
                </h2>
                <p className="text-xs text-slate-400 font-medium">{lang === "bn" ? "রুম কোড শেয়ার করে বন্ধুদের ইনভাইট করো" : "Invite friends by sharing the room code"}</p>
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
                        {lang === "bn" ? "স্ট্যাটাস:" : "Status:"} <strong className="text-slate-600">{member.status}</strong>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-cyan-600">
                          {member.progress}%
                        </span>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{lang === "bn" ? "পড়া শেষ" : "Completed"}</p>
                      </div>
                    </div>

                    {/* Member Progress Bar */}
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-cyan-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${member.progress}%` }}
                      ></div>
                    </div>

                    <div className={`flex justify-between items-center text-xs text-slate-500 font-semibold pt-1 border-t ${darkMode ? "border-[#3a4557]" : "border-slate-200/60"}`}>
                      <span>{lang === "bn" ? "সেরা ৩ CT গড়:" : "Best 3 CT Avg:"}</span>
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
                    <p className="text-slate-600 font-bold">{lang === "bn" ? "এখনো কোনো কোর্স যোগ করা হয়নি" : "No courses added yet"}</p>
                    <p className="text-slate-400 text-sm">
                      {lang === "bn" ? 'উপরের "নতুন কোর্স" বাটনে চেপে শুরু করো' : 'Tap the "Add New Course" button above to get started'}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-600 font-bold">{lang === "bn" ? "এখনো কোনো বন্ধুর কোর্স শেয়ার করা হয়নি" : "No friend's courses shared yet"}</p>
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

              // Calculation of what's needed to get an A+
              const ctVal = parseFloat(best3Avg) || 0;
              const assignVal = course.assignmentMark !== null ? Number(course.assignmentMark) : 0;
              const attendVal = course.attendanceMark !== null ? Number(course.attendanceMark) : 0;
              const currentTotalMarks = ctVal + assignVal + attendVal;
              const neededForA = 80 - currentTotalMarks;
              const isCardExpanded = course.cardExpanded !== false;

              return (
                <div
                  key={course.id}
                  className={`bg-white rounded-3xl p-6 shadow-sm border transition relative ${
                    !isCardExpanded ? "pb-3" : ""
                  } ${
                    course.isPinned
                      ? "border-amber-400 ring-2 ring-amber-100 shadow-amber-50"
                      : "border-slate-200 hover:shadow-md"
                  }`}
                >
                  {/* Course Header */}
                  <div
                    className={`flex flex-wrap justify-between items-start gap-2 ${
                      isCardExpanded ? "border-b border-slate-100 pb-4 mb-4" : ""
                    }`}
                  >
                    <div className="w-full sm:w-auto">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-blueprint font-bold text-slate-800">
                          {index + 1}. {course.name}
                        </h2>
                        {course.isPinned && (
                          <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-300">
                            {lang === "bn" ? "📌 পিন করা" : "📌 Pinned"}
                          </span>
                        )}
                      </div>
                      <span className="inline-block mt-1.5 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-dashed border-blue-300">
                        Credit: {course.credit}
                      </span>
                      {(course.teacher1 || course.teacher2) && (
                        <span className="inline-block mt-1.5 ml-1.5 bg-cyan-50 text-cyan-700 text-xs font-bold px-3 py-1 rounded-full border border-dashed border-cyan-300">
                          {`👨‍🏫 ${course.teacher1 || (lang === "bn" ? "শিক্ষক ১" : "Teacher 1")} ${lang === "bn" ? "ও" : "and"} ${course.teacher2 || (lang === "bn" ? "শিক্ষক ২" : "Teacher 2")}`}
                        </span>
                      )}
                    </div>

                    {/* Middle section: shows Best 3 CT and what's needed for A+ when minimized */}
                    {!isCardExpanded && (
                      <div className="flex-1 flex flex-col items-center justify-center min-w-[100px] sm:min-w-[130px]">
                        <p className="text-lg font-bold text-blue-500 whitespace-nowrap">
                          {lang === "bn" ? "সিটি গড়:" : "CT Average:"} <span className="text-blue-600">{best3Avg}</span>
                        </p>
                        <p className="text-sm font-black text-emerald-600 whitespace-nowrap text-center">
                          {neededForA <= 0
                            ? (lang === "bn" ? "A+ নিশ্চিত! 🎉" : "A+ Secured! 🎉")
                            : (lang === "bn" ? `A+ পেতে: ${neededForA.toFixed(1)}` : `Need for A+: ${neededForA.toFixed(1)}`)}
                        </p>
                      </div>
                    )}

                    {/* Header Actions */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
                      <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                        <button
                          disabled={index === 0}
                          onClick={() => handleMoveCourse(index, "up")}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-slate-600 hover:text-blue-600 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition"
                          title={lang === "bn" ? "উপরে তোলো" : "Move up"}
                        >
                          ▲
                        </button>
                        <button
                          disabled={index === currentCourses.length - 1}
                          onClick={() => handleMoveCourse(index, "down")}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-slate-600 hover:text-blue-600 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition"
                          title={lang === "bn" ? "নিচে নামাও" : "Move down"}
                        >
                          ▼
                        </button>
                      </div>

                      {/* Three-dot menu: pin, edit, delete together */}
                      <div className="relative z-50">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenCourseMenuId(openCourseMenuId === course.id ? null : course.id);
                          }}
                          title={lang === "bn" ? "আরও অপশন" : "More options"}
                          className={`w-8 h-8 flex items-center justify-center rounded-xl border transition text-base font-black ${
                            openCourseMenuId === course.id
                              ? "bg-blue-50 text-blue-600 border-blue-200"
                              : "bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border-slate-200"
                          }`}
                        >
                          ⋮
                        </button>

                        {openCourseMenuId === course.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50"
                          >
                            <button
                              onClick={() => {
                                handleTogglePin(course.id);
                                setOpenCourseMenuId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2"
                            >
                              📍 {course.isPinned ? (lang === "bn" ? "আনপিন করো" : "Unpin") : (lang === "bn" ? "পিন করো" : "Pin")}
                            </button>
                            {activeTab === "my" && (
                              <>
                                <button
                                  onClick={() => {
                                    handleOpenRenameCourse(course);
                                    setOpenCourseMenuId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                >
                                  {lang === "bn" ? "✏️ এডিট করো" : "✏️ Edit"}
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenCourseMenuId(null);
                                    handleDeleteCourse(course.id);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"
                                >
                                  {lang === "bn" ? "🗑️ ডিলিট করো" : "🗑️ Delete"}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-right ml-2">
                        <span className="text-2xl font-black text-blue-600">
                          {progressPercent}%
                        </span>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                          {lang === "bn" ? "কমপ্লিট" : "Complete"}
                        </p>
                      </div>

                      <button
                        onClick={() => toggleCourseCard(course.id)}
                        title={isCardExpanded ? (lang === "bn" ? "মিনিমাইজ করো" : "Minimize") : (lang === "bn" ? "এক্সপান্ড করো" : "Expand")}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition shrink-0"
                      >
                        {isCardExpanded ? "\u25b2" : "\u25bc"}
                      </button>
                    </div>
                  </div>

                  {isCardExpanded && (
                  <>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-start">
                    {/* Chapters & Topics List (grouped by teacher) */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          {lang === "bn" ? "চ্যাপ্টার ও টপিক সিলেবাস" : "Chapters & Topics Syllabus"}
                        </h3>
                        {activeTab === "my" && (
                          <button
                            onClick={() => setAddChapterModal({ isOpen: true, courseId: course.id, name: "", teacher: "teacher1" })}
                            className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg transition"
                          >
                            {lang === "bn" ? "+ চ্যাপ্টার" : "+ Chapter"}
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
                            <div key={tKey} className={`border rounded-xl overflow-hidden ${darkMode ? "border-[rgba(45,212,191,0.35)]" : "border-cyan-200"}`}>
                              {/* Teacher Section Header */}
                              <div
                                onClick={() => toggleTeacherSection(sectionKey)}
                                className={`flex items-center justify-between gap-2 p-2.5 cursor-pointer select-none ${darkMode ? "bg-[rgba(45,212,191,0.14)] hover:bg-[rgba(45,212,191,0.2)]" : "bg-cyan-50/70 hover:bg-cyan-50"}`}
                              >
                                <span className={`text-xs font-bold flex items-center gap-1.5 min-w-0 ${darkMode ? "text-[#7dd3c8]" : "text-cyan-800"}`}>
                                  <span className="shrink-0">👨‍🏫</span>
                                  <span className="truncate">{getTeacherLabel(course, tKey)}</span>
                                </span>
                                <span className="flex items-center gap-2 shrink-0">
                                  {teacherChapters.length > 0 && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${darkMode ? "text-[#5eeada] bg-[#1e2530] border-[rgba(45,212,191,0.35)]" : "text-cyan-700 bg-white border-cyan-200"}`}>
                                      {doneCount}/{teacherChapters.length}
                                    </span>
                                  )}
                                  <span className={`text-xs ${darkMode ? "text-[#5eeada]" : "text-cyan-400"}`}>{isSectionExpanded ? "▲" : "▼"}</span>
                                </span>
                              </div>

                              {/* Teacher Section Body */}
                              {isSectionExpanded && (
                                <div className={`p-2 space-y-2 ${darkMode ? "bg-[#1e2530]" : "bg-white"}`}>
                                  {teacherChapters.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic px-1 py-1.5">
                                      {lang === "bn" ? "এই শিক্ষকের কোনো চ্যাপ্টার যোগ করা হয়নি" : "No chapters added for this teacher yet"}
                                    </p>
                                  ) : (
                                    teacherChapters.map((chap) => (
                                      <div
                                        key={chap.id}
                                        className={`border rounded-xl overflow-hidden transition ${darkMode ? "border-[#313a49] bg-[#202836] hover:bg-[#232c3a]" : "border-slate-100 bg-slate-50/50 hover:bg-slate-50"}`}
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
                                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${darkMode ? "text-[#a3abbb] bg-[#333e4e99]" : "text-slate-400 bg-slate-200/60"}`}>
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
                                                  title={lang === "bn" ? "এডিট করো" : "Edit"}
                                                  className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-600 transition shrink-0"
                                                >
                                                  ✏️
                                                </button>
                                                <button
                                                  onClick={(e) => handleDeleteChapter(course.id, chap.id, e)}
                                                  title={lang === "bn" ? "ডিলিট করো" : "Delete"}
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
                                          <div className={`p-3 pl-8 space-y-2 border-t ${darkMode ? "bg-[#1e2530] border-[#313a49]" : "bg-white border-slate-100"}`}>
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
                                              <p className="text-[11px] text-slate-400 italic">{lang === "bn" ? "কোনো টপিক যোগ করা হয়নি" : "No topics added"}</p>
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
                                                {lang === "bn" ? "+ টপিক যোগ করো" : "+ Add Topic"}
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
                    <div className={`p-4 rounded-2xl border flex flex-col justify-between space-y-4 ${darkMode ? "bg-[#202836] border-[#313a49]" : "bg-slate-50 border-slate-100"}`}>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {lang === "bn" ? "ক্লাস টেস্ট মার্কস (Max 4)" : "Class Test Marks (Max 4)"}
                          </h3>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {course.ctMarks.length > 0 ? (
                            course.ctMarks.map((mark, i) => (
                              <div
                                key={i}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-bold shadow-sm flex items-center gap-1.5 ${darkMode ? "bg-[#1e2530] border-[#3a4557] text-[#d7dbe3]" : "bg-white border-slate-200 text-slate-700"}`}
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
                                    title={lang === "bn" ? "এডিট / ডিলিট করো" : "Edit / Delete"}
                                    className="text-slate-400 hover:text-blue-600 text-[10px] ml-1"
                                  >
                                    ✏️
                                  </button>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400">{lang === "bn" ? "কোনো CT মার্কস নেই" : "No CT marks yet"}</p>
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
                            className={`w-full text-xs font-bold py-2 px-3 border rounded-xl transition mb-3 shadow-sm ${darkMode ? "bg-[#1e2530] hover:bg-[#29323f] border-[#3a4557] text-[#d7dbe3]" : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"}`}
                          >
                            {lang === "bn" ? `+ CT মার্কস যোগ করো (${course.ctMarks.length}/4)` : `+ Add CT Marks (${course.ctMarks.length}/4)`}
                          </button>
                        )}

                        {/* Best 3 Average */}
                        <div className={`border p-3.5 rounded-2xl text-center ${darkMode ? "bg-[rgba(99,102,241,0.14)] border-[rgba(99,102,241,0.25)]" : "bg-blue-50/80 border-blue-100"}`}>
                          <p className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? "text-[#8b93f8]" : "text-blue-500"}`}>
                            {lang === "bn" ? "সেরা ৩ CT গড়" : "Best 3 CT Average"}
                          </p>
                          <p className={`text-2xl font-black mt-0.5 ${darkMode ? "text-[#93a0fa]" : "text-blue-600"}`}>
                            {best3Avg}
                          </p>
                        </div>
                      </div>

                      {/* Assignment, Attendance & Needed For A+ Section */}
                      <div className={`pt-3 border-t space-y-2.5 ${darkMode ? "border-[#3a4557]" : "border-slate-200/60"}`}>
                        {/* Assignment */}
                        <div className={`flex items-center justify-between p-3 rounded-xl border shadow-sm ${darkMode ? "bg-[#1e2530] border-[#3a4557]" : "bg-white border-slate-200"}`}>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              {lang === "bn" ? "অ্যাসাইনমেন্ট" : "Assignment"}
                            </span>
                            <span className="text-sm font-extrabold text-slate-800">
                              {course.assignmentMark !== null ? course.assignmentMark : (lang === "bn" ? "নেই" : "None")}
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
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${darkMode ? "bg-[#29323f] hover:bg-[#333e4e] text-[#d7dbe3]" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}
                            >
                              {course.assignmentMark !== null ? (lang === "bn" ? "✏️ এডিট" : "✏️ Edit") : (lang === "bn" ? "+ যোগ করো" : "+ Add")}
                            </button>
                          )}
                        </div>

                        {/* Attendance */}
                        <div className={`flex items-center justify-between p-3 rounded-xl border shadow-sm ${darkMode ? "bg-[#1e2530] border-[#3a4557]" : "bg-white border-slate-200"}`}>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              {lang === "bn" ? "অ্যাটেনডেন্স (উপস্থিতি)" : "Attendance"}
                            </span>
                            <span className="text-sm font-extrabold text-slate-800">
                              {course.attendanceMark !== null ? course.attendanceMark : (lang === "bn" ? "নেই" : "None")}
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
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${darkMode ? "bg-[#29323f] hover:bg-[#333e4e] text-[#d7dbe3]" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}
                            >
                              {course.attendanceMark !== null ? (lang === "bn" ? "✏️ এডিট" : "✏️ Edit") : (lang === "bn" ? "+ যোগ করো" : "+ Add")}
                            </button>
                          )}
                        </div>

                        {/* ✨ What's needed to get A+ (80) - calculation box ✨ */}
                        <div className={`border p-3.5 rounded-2xl text-center shadow-sm ${darkMode ? "bg-[rgba(52,211,153,0.14)] border-[rgba(52,211,153,0.35)]" : "bg-emerald-50/80 border-emerald-200"}`}>
                          <div className={`flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider mb-1 ${darkMode ? "text-[#86efc0]" : "text-emerald-800"}`}>
                            <span>{lang === "bn" ? "🎯 A+ (80) পেতে দরকার" : "🎯 Needed for A+ (80)"}</span>
                            <span className={`px-2 py-0.5 rounded-full font-bold ${darkMode ? "bg-[rgba(52,211,153,0.2)] text-[#86efc0]" : "bg-emerald-100 text-emerald-800"}`}>
                              {lang === "bn" ? "ইনকোর্স:" : "In-course:"} {currentTotalMarks.toFixed(1)}/40
                            </span>
                          </div>

                          <div className={`text-2xl font-black mt-1 ${darkMode ? "text-[#6de6ab]" : "text-emerald-700"}`}>
                            {neededForA <= 0 ? (
                              <span className={`text-xl ${darkMode ? "text-[#6de6ab]" : "text-emerald-600"}`}>{lang === "bn" ? "A+ নিশ্চিত! 🎉" : "A+ Secured! 🎉"}</span>
                            ) : (
                              <span>
                                {neededForA.toFixed(1)}{" "}
                                <span className={`text-xs font-bold ${darkMode ? "text-[#6de6ab]" : "text-emerald-600"}`}>/ 60</span>
                              </span>
                            )}
                          </div>

                          {neededForA > 60 && (
                            <p className="text-[10px] text-red-500 font-bold mt-1">
                              {lang === "bn" ? "⚠️ ফাইনাল পরীক্ষা 60 নম্বরের, তাই 80 পাওয়া সম্ভব নয়!" : "⚠️ The final exam is worth 60 marks, so reaching 80 isn't possible!"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Course button moved up next to "Sort by Credit" — see Tab Switcher & Quick Actions section above */}
      </div>

      {/* ================= MODALS SECTION ================= */}

      {/* 1. Create Room Modal */}
      {isCreateRoomModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
              {lang === "bn" ? "🏠 নতুন স্টাডি রুম তৈরি করো" : "🏠 Create New Study Room"}
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{lang === "bn" ? "রুমের নাম" : "Room Name"}</label>
              <input
                type="text"
                placeholder={lang === "bn" ? "যেমন: CSE Batch 2026" : "e.g., CSE Batch 2026"}
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-medium text-slate-800 placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{lang === "bn" ? "রুম কোড (বন্ধুদের শেয়ার করার জন্য)" : "Room Code (to share with friends)"}</label>
              <input
                type="text"
                placeholder={lang === "bn" ? "যেমন: CSE2026" : "e.g., CSE2026"}
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
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={handleCreateRoom}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-md shadow-cyan-100"
              >
                {lang === "bn" ? "তৈরি করো" : "Create"}
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
              {lang === "bn" ? "🔑 স্টাডি রুমে জয়েন করো" : "🔑 Join Study Room"}
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{lang === "bn" ? "রুম কোড টাইপ করো" : "Enter Room Code"}</label>
              <input
                type="text"
                placeholder={lang === "bn" ? "যেমন: CSE2026" : "e.g., CSE2026"}
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
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={handleJoinRoom}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-md shadow-cyan-100"
              >
                {lang === "bn" ? "জয়েন করো" : "Join"}
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
              {lang === "bn" ? "➕ নতুন কোর্স তৈরি করো" : "➕ Create New Course"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{lang === "bn" ? "কোর্সের নাম" : "Course Name"}</label>
                <input
                  type="text"
                  placeholder={lang === "bn" ? "যেমন: Algorithm Design" : "e.g., Algorithm Design"}
                  value={courseNameInput}
                  onChange={(e) => setCourseNameInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{lang === "bn" ? "কোর্স ক্রেডিট" : "Course Credit"}</label>
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
                  <label className="block text-xs font-bold text-slate-500 mb-1">👨‍🏫 {lang === "bn" ? "শিক্ষক ১" : "Teacher 1"}</label>
                  <input
                    type="text"
                    placeholder={lang === "bn" ? "যেমন: Dr. Rahman" : "e.g., Dr. Rahman"}
                    value={teacher1Input}
                    onChange={(e) => setTeacher1Input(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium text-slate-800 placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">👨‍🏫 {lang === "bn" ? "শিক্ষক ২" : "Teacher 2"}</label>
                  <input
                    type="text"
                    placeholder={lang === "bn" ? "যেমন: Dr. Karim" : "e.g., Dr. Karim"}
                    value={teacher2Input}
                    onChange={(e) => setTeacher2Input(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium text-slate-800 placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-500">{lang === "bn" ? "চ্যাপ্টারগুলোর নাম (কোন শিক্ষক পড়াবেন সিলেক্ট করো)" : "Chapter Names (select which teacher will teach)"}</label>
                  <button
                    onClick={handleAddChapterField}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    {lang === "bn" ? "+ আরও চ্যাপ্টার" : "+ Add More Chapters"}
                  </button>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {chapterInputs.map((ch, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder={lang === "bn" ? `চ্যাপ্টার ${idx + 1}` : `Chapter ${idx + 1}`}
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
                          {teacher1Input.trim() || (lang === "bn" ? "শিক্ষক ১" : "Teacher 1")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChapterFieldTeacherChange(idx, "teacher2")}
                          className={`px-2 py-1.5 rounded-md text-[10px] font-bold transition ${
                            ch.teacher === "teacher2" ? "bg-cyan-600 text-white" : "text-slate-500"
                          }`}
                        >
                          {teacher2Input.trim() || (lang === "bn" ? "শিক্ষক ২" : "Teacher 2")}
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
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={handleSaveNewCourse}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100"
              >
                {lang === "bn" ? "কোর্স সেভ করো" : "Save Course"}
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
              {lang === "bn" ? "📖 নতুন চ্যাপ্টার যুক্ত করো" : "📖 Add New Chapter"}
            </h3>
            <input
              type="text"
              placeholder={lang === "bn" ? "চ্যাপ্টারের নাম..." : "Chapter name..."}
              value={addChapterModal.name}
              onChange={(e) => setAddChapterModal({ ...addChapterModal, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800 placeholder-slate-400"
            />
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">{lang === "bn" ? "কোন শিক্ষক পড়াবেন?" : "Which teacher will teach?"}</label>
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
                      👨‍🏫 {modalCourse ? getTeacherLabel(modalCourse, tKey) : tKey === "teacher1" ? (lang === "bn" ? "শিক্ষক ১" : "Teacher 1") : (lang === "bn" ? "শিক্ষক ২" : "Teacher 2")}
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
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={handleSaveNewChapter}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                {lang === "bn" ? "যোগ করো" : "Add"}
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
              {lang === "bn" ? "📌 চ্যাপ্টারের ভেতরে টপিক যোগ করো" : "📌 Add Topic Inside Chapter"}
            </h3>
            <input
              type="text"
              placeholder={lang === "bn" ? "টপিকের নাম..." : "Topic name..."}
              value={addTopicModal.name}
              onChange={(e) => setAddTopicModal({ ...addTopicModal, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800 placeholder-slate-400"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAddTopicModal({ isOpen: false, courseId: null, chapterId: null, name: "" })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={handleSaveNewTopic}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                {lang === "bn" ? "যোগ করো" : "Add"}
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
              {lang === "bn" ? "✏️ চ্যাপ্টারের নাম পরিবর্তন করো" : "✏️ Rename Chapter"}
            </h3>
            <input
              type="text"
              value={editChapterModal.name}
              onChange={(e) => setEditChapterModal({ ...editChapterModal, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800 placeholder-slate-400"
            />
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">{lang === "bn" ? "কোন শিক্ষক পড়াবেন?" : "Which teacher will teach?"}</label>
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
                      👨‍🏫 {modalCourse ? getTeacherLabel(modalCourse, tKey) : tKey === "teacher1" ? (lang === "bn" ? "শিক্ষক ১" : "Teacher 1") : (lang === "bn" ? "শিক্ষক ২" : "Teacher 2")}
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
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={handleSaveEditChapter}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                {lang === "bn" ? "সেভ করো" : "Save"}
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
              {lang === "bn" ? "🎯 নম্বর বসাও / আপডেট করো" : "🎯 Enter / Update Marks"}
            </h3>
            <input
              type="number"
              placeholder={lang === "bn" ? "নম্বর টাইপ করো..." : "Enter marks..."}
              value={markModal.value}
              onChange={(e) => setMarkModal({ ...markModal, value: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800 placeholder-slate-400"
            />
            <p className="text-[11px] text-slate-400">
              {lang === "bn" ? "* নম্বর মুছে ফেলতে বক্স খালি রেখে সেভ দাও" : "* Leave the box empty and save to remove the marks"}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setMarkModal({ isOpen: false, type: "", courseId: null, ctIndex: null, value: "" })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={handleSaveMarkModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                {lang === "bn" ? "সেভ করো" : "Save"}
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
              {lang === "bn" ? "✏️ কোর্সের তথ্য পরিবর্তন করো" : "✏️ Edit Course Details"}
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Course Name</label>
              <input
                type="text"
                value={renameCourseModal.name}
                onChange={(e) => setRenameCourseModal({ ...renameCourseModal, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800 placeholder-slate-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">👨‍🏫 Teacher 1</label>
                <input
                  type="text"
                  placeholder="e.g., Dr. Rahman"
                  value={renameCourseModal.teacher1}
                  onChange={(e) => setRenameCourseModal({ ...renameCourseModal, teacher1: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium text-slate-800 placeholder-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">👨‍🏫 Teacher 2</label>
                <input
                  type="text"
                  placeholder="e.g., Dr. Karim"
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
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={handleSaveRenameCourse}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                {lang === "bn" ? "সেভ করো" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl leading-none">🏗️</span>
                  <span className="text-xl font-black uppercase tracking-wide text-blue-950">
                    Study Tracker
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 ml-0.5">
                  <span className="text-[10px] text-slate-400 italic font-semibold tracking-wide">
                    by Akib
                  </span>
                  <span className="text-slate-300 text-[10px]">•</span>
                  <h3 className="text-xs font-bold text-slate-500">
                    {lang === "bn" ? "⚙️ সেটিংস" : "⚙️ Settings"}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div>
                <span className="text-sm font-bold text-slate-800 block">
                  {lang === "bn" ? "🌙 ডার্ক মোড" : "🌙 Dark Mode"}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {lang === "bn" ? "রাতে অ্যাপ ব্যবহারের জন্য কাজে লাগে" : "Useful for using the app at night"}
                </span>
              </div>
              <button
                onClick={handleToggleDarkMode}
                className={`w-12 h-7 rounded-full transition relative shrink-0 ${
                  darkMode ? "bg-blue-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                    darkMode ? "left-6" : "left-1"
                  }`}
                ></span>
              </button>
            </div>

            {/* Reopen Behavior */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
              <span className="text-sm font-bold text-slate-800 block">
                {lang === "bn" ? "📱 অ্যাপ খুললে কোর্স কেমন দেখাবে" : "📱 How courses appear when the app opens"}
              </span>
              <div className="flex bg-white rounded-xl p-1 gap-1 border border-slate-200">
                <button
                  onClick={() => handleSetRestoreLastState(true)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                    restoreLastState ? "bg-blue-600 text-white shadow-sm" : "text-slate-500"
                  }`}
                >
                  {lang === "bn" ? "যেভাবে রেখে গিয়েছিলে" : "As you left it"}
                </button>
                <button
                  onClick={() => handleSetRestoreLastState(false)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                    !restoreLastState ? "bg-blue-600 text-white shadow-sm" : "text-slate-500"
                  }`}
                >
                  {lang === "bn" ? "সবসময় মিনিমাইজ" : "Always minimized"}
                </button>
              </div>
            </div>

            {/* Clear All Data */}
            <button
              onClick={handleOpenClearDataModal}
              className="w-full text-left flex items-center justify-between bg-red-50 hover:bg-red-100 p-3.5 rounded-2xl border border-red-200 transition"
            >
              <span className="text-sm font-bold text-red-600 flex items-center gap-2">
                {lang === "bn" ? "🗑️ সব ডেটা মুছে ফেলো" : "🗑️ Clear All Data"}
              </span>
              <span className="text-red-400">›</span>
            </button>

            {/* Account Section */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name}
                    className="w-9 h-9 rounded-full object-cover border border-blue-200 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-xs font-extrabold flex items-center justify-center shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-[11px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full transition shrink-0"
              >
                {lang === "bn" ? "লগ-আউট" : "Log Out"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Clear Data Modal */}
      {clearDataModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            {clearDataModal.step === "confirm" ? (
              <>
                <h3 className="text-base font-bold text-slate-800">
                  {lang === "bn" ? "🗑️ সব ডেটা মুছে ফেলো" : "🗑️ Clear All Data"}
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  {lang === "bn" ? "তুমি কি সব কোর্স ডিলিট করতে চাও, নাকি নির্দিষ্ট কিছু কোর্স বেছে ডিলিট করতে চাও?" : "Do you want to delete all courses, or choose specific ones to delete?"}
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={handleClearAllCourses}
                    className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-100"
                  >
                    {lang === "bn" ? "সব কোর্স ডিলিট করো" : "Delete All Courses"}
                  </button>
                  <button
                    onClick={handleGoToSelectDelete}
                    className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    {lang === "bn" ? "নির্দিষ্ট কিছু বেছে নাও" : "Choose Specific Courses"}
                  </button>
                  <button
                    onClick={() => setClearDataModal({ isOpen: false, step: "confirm", selected: {} })}
                    className="w-full px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                  >
                    {lang === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-slate-800">
                  {lang === "bn" ? "কোর্স বেছে নাও" : "Choose Courses"}
                </h3>
                {myCourses.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    {lang === "bn" ? "কোনো কোর্স নেই" : "No courses"}
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {myCourses.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={!!clearDataModal.selected[String(c.id)]}
                          onChange={() => handleToggleSelectCourseForDelete(String(c.id))}
                          className="w-4 h-4 accent-red-600 rounded cursor-pointer shrink-0"
                        />
                        <span className="text-sm font-semibold text-slate-700 truncate">{c.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setClearDataModal({ isOpen: false, step: "confirm", selected: {} })}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                  >
                    {lang === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                  <button
                    onClick={handleDeleteSelectedCourses}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
                  >
                    {lang === "bn" ? "ডিলিট করো" : "Delete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Clicking outside the menu will close the three-dot menu */}
      {openCourseMenuId !== null && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenCourseMenuId(null)}
        />
      )}

      {/* 11. Generic confirmation modal (shown before any delete) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">{confirmModal.title}</h3>
            <p className="text-sm text-slate-500 font-medium">{confirmModal.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeConfirmModal}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={handleConfirmModalYes}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-100"
              >
                {lang === "bn" ? "হ্যাঁ, ডিলিট করো" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings & Undo Buttons (bottom-left) */}
      <div className="fixed bottom-3 [bottom:calc(0.75rem+env(safe-area-inset-bottom))] left-3 z-40 flex items-center gap-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className={`flex items-center gap-1.5 backdrop-blur-sm border rounded-full pl-2.5 pr-3.5 py-2 shadow-md transition ${darkMode ? "bg-[rgba(30,37,48,0.9)] border-[#3a4557] hover:bg-[#1e2530]" : "bg-white/90 border-slate-200/70 hover:bg-white"}`}
          title="Settings"
        >
          <span className="text-base">⚙️</span>
          <span className={`text-[11px] font-bold ${darkMode ? "text-[#a3abbb]" : "text-slate-500"}`}>
            {lang === "bn" ? "সেটিংস" : "Settings"}
          </span>
        </button>

        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className={`flex items-center gap-1.5 backdrop-blur-sm border rounded-full pl-2.5 pr-3.5 py-2 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed ${darkMode ? "bg-[rgba(30,37,48,0.9)] border-[#3a4557] hover:bg-[#1e2530]" : "bg-white/90 border-slate-200/70 hover:bg-white"}`}
          title={canUndo ? (lang === "bn" ? "আগের অবস্থায় ফিরিয়ে নাও" : "Restore previous state") : (lang === "bn" ? "ফিরিয়ে নেওয়ার মতো কিছু নেই" : "Nothing to undo")}
        >
          <span className="text-base">↩️</span>
          <span className={`text-[11px] font-bold ${darkMode ? "text-[#a3abbb]" : "text-slate-500"}`}>{"Undo"}</span>
        </button>
      </div>

      {/* Language Toggle Button (bottom-right) */}
      <div className="fixed bottom-14 [bottom:calc(3.5rem+env(safe-area-inset-bottom))] right-3 z-40">
        <button
          onClick={handleToggleLang}
          className={`flex items-center gap-1.5 backdrop-blur-sm border rounded-full pl-2.5 pr-3.5 py-2 shadow-md transition ${darkMode ? "bg-[rgba(30,37,48,0.9)] border-[#3a4557] hover:bg-[#1e2530]" : "bg-white/90 border-slate-200/70 hover:bg-white"}`}
          title={lang === "bn" ? "Switch to English" : "বাংলায় পরিবর্তন করো"}
        >
          <span className="text-base">🌐</span>
          <span className={`text-[11px] font-bold ${darkMode ? "text-[#a3abbb]" : "text-slate-500"}`}>
            {lang === "bn" ? "EN" : "বাং"}
          </span>
        </button>
      </div>

      {/* Signature Watermark */}
      <div className="fixed bottom-3 [bottom:calc(0.75rem+env(safe-area-inset-bottom))] right-3 z-40 pointer-events-none select-none">
        <div className={`flex items-center gap-1.5 backdrop-blur-sm border rounded-full pl-2 pr-3 py-1 shadow-sm ${darkMode ? "bg-[rgba(30,37,48,0.7)] border-[#3a4557]" : "bg-white/70 border-slate-200/70"}`}>
          <span className="text-[13px]">🏗️</span>
          <span className={`text-[10px] font-semibold tracking-wide ${darkMode ? "text-[#7c8598]" : "text-slate-400"}`}>
            Made by Akib · Civil'24, RUET
          </span>
        </div>
      </div>
    </div>
  );
}
