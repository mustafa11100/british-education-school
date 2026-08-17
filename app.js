let me = null;

const app = document.getElementById("app");

/* =========================
   API
========================= */

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "حدث خطأ في الخادم");
  }

  return data;
}

/* =========================
   LOGIN
========================= */

function loginPage() {
  app.innerHTML = `
    <div class="login">
      <h1>🏫 بوابة مدرسة التعليم البريطاني</h1>

      <input
        id="username"
        placeholder="اسم المستخدم"
      >

      <input
        id="password"
        type="password"
        placeholder="كلمة المرور"
      >

      <button onclick="login()">
        دخول
      </button>

      <div class="notice">
        للتجربة:<br>
        admin / 1234<br>
        teacher / 1234<br>
        parent / 1234<br>
        student / 1234
      </div>
    </div>
  `;
}

async function login() {
  try {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
      alert("أدخل اسم المستخدم وكلمة المرور");
      return;
    }

    me = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username,
        password
      })
    });

    localStorage.setItem("me", JSON.stringify(me));

    render();

  } catch (error) {
    alert(error.message);
  }
}

/* =========================
   LOGOUT
========================= */

function logout() {
  localStorage.removeItem("me");
  me = null;
  loginPage();
}

/* =========================
   RENDER
========================= */

async function render() {

  if (!me) {
    loginPage();
    return;
  }

  try {

    if (me.role === "admin") {
      await adminPage();
      return;
    }

    if (me.role === "teacher") {
      await teacherPage();
      return;
    }

    await familyPage();

  } catch (error) {

    console.error(error);

    app.innerHTML = `
      <div class="wrap">
        <div class="notice">
          حدث خطأ أثناء تحميل الصفحة.
          <br>
          ${error.message}
        </div>

        <button onclick="logout()">
          العودة لتسجيل الدخول
        </button>
      </div>
    `;
  }
}

/* =========================
   ADMIN
========================= */

async function adminPage() {

  const students = await api("/api/students");
  const users = await api("/api/users");

  const present = students.filter(
    s => s.status === "حاضر"
  ).length;

  const absent = students.filter(
    s => s.status === "غائب"
  ).length;

  const online = users.filter(
    u => u.online
  ).length;

  app.innerHTML = `
    <div class="wrap">

      <h1>لوحة الإدارة</h1>

      <div class="cards">

        <div class="card">
          الطلاب
          <div class="num">${students.length}</div>
        </div>

        <div class="card">
          الحاضرون
          <div class="num">${present}</div>
        </div>

        <div class="card">
          الغائبون
          <div class="num">${absent}</div>
        </div>

        <div class="card">
          المتصلون الآن
          <div class="num">${online}</div>
        </div>

      </div>

      <h2>👥 إدارة المستخدمين</h2>

      <div class="form">

        <h3>إضافة مستخدم جديد</h3>

        <input
          id="newName"
          placeholder="اسم المستخدم"
        >

        <input
          id="newUsername"
          placeholder="اسم الدخول"
        >

        <input
          id="newPassword"
          placeholder="كلمة المرور"
        >

        <select id="newRole">

          <option value="teacher">
            مدرس
          </option>

          <option value="parent">
            ولي أمر
          </option>

          <option value="student">
            طالب
          </option>

          <option value="admin">
            مدير
          </option>

        </select>

        <button onclick="addUser()">
          ➕ إضافة المستخدم
        </button>

      </div>

      <h3>المستخدمون</h3>

      <table class="table">

        <tr>
          <th>الاسم</th>
          <th>اسم المستخدم</th>
          <th>الصلاحية</th>
          <th>الحالة</th>
          <th>آخر نشاط</th>
          <th>إجراء</th>
        </tr>

        ${users.map(user => `

          <tr>

            <td>${escapeHtml(user.name)}</td>

            <td>${escapeHtml(user.username)}</td>

            <td>${roleName(user.role)}</td>

            <td>
              ${
                !user.active
                  ? "🔴 موقوف"
                  : user.online
                    ? "🟢 متصل الآن"
                    : "⚪ غير متصل"
              }
            </td>

            <td>
              ${
                user.last_seen
                  ? new Date(user.last_seen).toLocaleString("ar-EG")
                  : "لم يدخل بعد"
              }
            </td>

            <td>

              ${
                user.username === "admin"

                  ? "<b>المدير الرئيسي</b>"

                  : user.active

                    ? `
                      <button
                        onclick="disableUser(${user.id})"
                      >
                        ⛔ إيقاف
                      </button>

                      <button
                        onclick="deleteUser(${user.id})"
                      >
                        🗑️ حذف
                      </button>
                    `

                    : `
                      <button
                        onclick="enableUser(${user.id})"
                      >
                        ✅ تفعيل
                      </button>

                      <button
                        onclick="deleteUser(${user.id})"
                      >
                        🗑️ حذف
                      </button>
                    `
              }

            </td>

          </tr>

        `).join("")}

      </table>

      <h2>👨‍🎓 الطلاب</h2>

      <table class="table">

        <tr>
          <th>الاسم</th>
          <th>الفصل</th>
          <th>الحالة</th>
          <th>WhatsApp ولي الأمر</th>
        </tr>

        ${students.map(student => `

          <tr>

            <td>${escapeHtml(student.name)}</td>

            <td>${escapeHtml(student.class_name)}</td>

            <td>
              ${
                student.status === "حاضر"
                  ? "🟢 حاضر"
                  : "🔴 غائب"
              }
            </td>

            <td>
              ${escapeHtml(student.parent_phone)}
            </td>

          </tr>

        `).join("")}

      </table>

      <h2>➕ إضافة طالب</h2>

      <div class="form">

        <input
          id="studentName"
          placeholder="اسم الطالب"
        >

        <input
          id="studentClass"
          placeholder="الفصل"
        >

        <input
          id="studentPhone"
          placeholder="رقم WhatsApp ولي الأمر"
        >

        <button onclick="addStudent()">
          إضافة الطالب
        </button>

      </div>

    </div>
  `;
}

/* =========================
   ADD USER
========================= */

async function addUser() {

  try {

    const name =
      document.getElementById("newName").value.trim();

    const username =
      document.getElementById("newUsername").value.trim();

    const password =
      document.getElementById("newPassword").value;

    const role =
      document.getElementById("newRole").value;

    if (!name || !username || !password) {
      alert("أكمل بيانات المستخدم");
      return;
    }

    await api("/api/users", {
      method: "POST",
      body: JSON.stringify({
        name,
        username,
        password,
        role
      })
    });

    alert("تم إضافة المستخدم بنجاح");

    await adminPage();

  } catch (error) {

    alert(error.message);

  }
}

/* =========================
   DISABLE USER
========================= */

async function disableUser(id) {

  if (!confirm("هل تريد إيقاف هذا المستخدم؟")) {
    return;
  }

  try {

    await api(`/api/users/${id}/disable`, {
      method: "PATCH"
    });

    await adminPage();

  } catch (error) {

    alert(error.message);

  }
}

/* =========================
   ENABLE USER
========================= */

async function enableUser(id) {

  try {

    await api(`/api/users/${id}/enable`, {
      method: "PATCH"
    });

    await adminPage();

  } catch (error) {

    alert(error.message);

  }
}

/* =========================
   DELETE USER
========================= */

async function deleteUser(id) {

  if (!confirm("هل تريد حذف هذا المستخدم نهائياً؟")) {
    return;
  }

  try {

    await api(`/api/users/${id}`, {
      method: "DELETE"
    });

    await adminPage();

  } catch (error) {

    alert(error.message);

  }
}

/* =========================
   ADD STUDENT
========================= */

async function addStudent() {

  try {

    const name =
      document.getElementById("studentName").value.trim();

    const className =
      document.getElementById("studentClass").value.trim();

    const phone =
      document.getElementById("studentPhone").value.trim();

    if (!name || !className || !phone) {
      alert("أكمل بيانات الطالب");
      return;
    }

    await api("/api/students", {
      method: "POST",
      body: JSON.stringify({
        name,
        class_name: className,
        parent_phone: phone
      })
    });

    alert("تم إضافة الطالب");

    await adminPage();

  } catch (error) {

    alert(error.message);

  }
}

/* =========================
   TEACHER
========================= */

async function teacherPage() {

  const students = await api("/api/students");

  app.innerHTML = `
    <div class="wrap">

      <h1>👨‍🏫 بوابة المدرس</h1>

      <h2>الحضور</h2>

      <table class="table">

        <tr>
          <th>الطالب</th>
          <th>الفصل</th>
          <th>الحالة</th>
          <th>إجراء</th>
        </tr>

        ${students.map(student => `

          <tr>

            <td>${escapeHtml(student.name)}</td>

            <td>${escapeHtml(student.class_name)}</td>

            <td>${student.status}</td>

            <td>

              <button
                onclick="toggleStatus(${student.id})"
              >
                تغيير الحالة
              </button>

            </td>

          </tr>

        `).join("")}

      </table>

      <div class="form">

        <h2>📝 ملاحظة لولي الأمر</h2>

        <select id="noteStudent">

          ${students.map(student => `
            <option value="${student.id}">
              ${escapeHtml(student.name)}
            </option>
          `).join("")}

        </select>

        <textarea
          id="noteText"
          placeholder="اكتب الملاحظة اليومية"
        ></textarea>

        <button onclick="saveNote()">
          حفظ الملاحظة
        </button>

      </div>

      <div class="form">

        <h2>🎥 إضافة حصة</h2>

        <input
          id="videoTitle"
          placeholder="اسم المادة والحصة"
        >

        <input
          id="videoFile"
          type="file"
          accept="video/*"
        >

        <button onclick="saveVideo()">
          حفظ الحصة
        </button>

      </div>

    </div>
  `;
}

/* =========================
   CHANGE ATTENDANCE
========================= */

async function toggleStatus(id) {

  try {

    await api(`/api/students/${id}/status`, {
      method: "PATCH"
    });

    await teacherPage();

  } catch (error) {

    alert(error.message);

  }
}

/* =========================
   SAVE NOTE
========================= */

async function saveNote() {

  try {

    const studentId =
      document.getElementById("noteStudent").value;

    const text =
      document.getElementById("noteText").value.trim();

    if (!text) {
      alert("اكتب الملاحظة");
      return;
    }

    await api("/api/notes", {
      method: "POST",
      body: JSON.stringify({
        student_id: Number(studentId),
        text
      })
    });

    alert("تم حفظ الملاحظة");

    await teacherPage();

  } catch (error) {

    alert(error.message);

  }
}

/* =========================
   SAVE VIDEO
========================= */

async function saveVideo() {

  try {

    const title =
      document.getElementById("videoTitle").value.trim();

    const file =
      document.getElementById("videoFile").files[0];

    if (!title) {
      alert("اكتب اسم الحصة");
      return;
    }

    await api("/api/videos", {
      method: "POST",
      body: JSON.stringify({
        title,
        file_name: file ? file.name : ""
      })
    });

    alert("تم حفظ بيانات الحصة");

  } catch (error) {

    alert(error.message);

  }
}

/* =========================
   PARENT / STUDENT
========================= */

async function familyPage() {

  const students =
    await api("/api/students");

  if (!students.length) {

    app.innerHTML = `
      <div class="wrap">
        <h1>بوابة ولي الأمر</h1>
        <div class="notice">
          لا يوجد طلاب حالياً.
        </div>
      </div>
    `;

    return;
  }

  const student = students[0];

  const notes =
    await api(`/api/notes/${student.id}`);

  const videos =
    await api("/api/videos");

  app.innerHTML = `
    <div class="wrap">

      <h1>👨‍👩‍👦 بوابة ولي الأمر</h1>

      <div class="cards">

        <div class="card">

          الطالب

          <div class="num">
            ${escapeHtml(student.name)}
          </div>

          <p>
            ${escapeHtml(student.class_name)}
          </p>

        </div>

        <div class="card">

          الحضور اليوم

          <div class="num">
            ${student.status}
          </div>

        </div>

      </div>

      <h2>📝 ملاحظات المدرسة</h2>

      ${
        notes.length

          ? notes.map(note => `

            <div class="notice">

              <b>
                ${escapeHtml(note.created_at)}
              </b>

              <br>

              ${escapeHtml(note.text)}

            </div>

          `).join("")

          : `
            <div class="card">
              لا توجد ملاحظات.
            </div>
          `
      }

      <h2>🎥 الحصص</h2>

      ${
        videos.length

          ? videos.map(video => `

            <div class="card">

              🎥 ${escapeHtml(video.title)}

              <br>

              <small>
                ${escapeHtml(video.created_at)}
              </small>

            </div>

          `).join("")

          : `
            <div class="card">
              لا توجد حصص.
            </div>
          `
      }

    </div>
  `;
}

/* =========================
   ROLE NAME
========================= */

function roleName(role) {

  const roles = {
    admin: "مدير",
    teacher: "مدرس",
    parent: "ولي أمر",
    student: "طالب"
  };

  return roles[role] || role;
}

/* =========================
   HTML SECURITY
========================= */

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================
   ACTIVITY
========================= */

setInterval(async () => {

  if (!me || !me.id) {
    return;
  }

  try {

    await api("/api/activity", {
      method: "POST",
      body: JSON.stringify({
        user_id: me.id
      })
    });

  } catch (error) {

    if (
      error.message.includes("موقوف") ||
      error.message.includes("موقوف")
    ) {

      logout();

    }

  }

}, 30000);

/* =========================
   START
========================= */

try {

  me = JSON.parse(
    localStorage.getItem("me") || "null"
  );

} catch (error) {

  me = null;

  localStorage.removeItem("me");

}

render();
