let me = null;
const app = document.getElementById("app");

async function api(url, opt = {}) {
const options = {
...opt,
headers: {
"Content-Type": "application/json",
...(opt.headers || {})
}
};

const response = await fetch(url, options);
const data = await response.json().catch(() => ({}));

if (!response.ok) {
throw new Error(data.error || "حدث خطأ");
}

return data;
}

function escapeHtml(value) {
return String(value ?? "")
.replaceAll("&", "&")
.replaceAll("<", "<")
.replaceAll(">", ">")
.replaceAll('"', """)
.replaceAll("'", "'");
}

function roleName(role) {
const roles = {
admin: "مدير",
teacher: "مدرس",
parent: "ولي أمر",
student: "طالب"
};

return roles[role] || role;
}

function formatDate(date) {
if (!date) return "لم يدخل بعد";

const d = new Date(date);

if (Number.isNaN(d.getTime())) {
return date;
}

return d.toLocaleString("ar-EG");
}

function logout() {
localStorage.removeItem("me");
me = null;
render();
}

function loginPage() {
app.innerHTML = ` <div class="login"> <h1>🏫 بوابة مدرسة التعليم البريطاني</h1>

```
  <input id="usernameInput"
         placeholder="اسم المستخدم"
         autocomplete="username">

  <input id="passwordInput"
         type="password"
         placeholder="كلمة المرور"
         autocomplete="current-password">

  <button onclick="login()">دخول</button>

  <div class="notice">
    <b>حسابات التجربة</b><br>
    الإدارة: admin / 1234<br>
    المدرس: teacher / 1234<br>
    ولي الأمر: parent / 1234<br>
    الطالب: student / 1234
  </div>
</div>
```

`;
}

async function login() {
const username = document.getElementById("usernameInput").value.trim();
const password = document.getElementById("passwordInput").value;

if (!username || !password) {
alert("أدخل اسم المستخدم وكلمة المرور");
return;
}

try {
me = await api("/api/login", {
method: "POST",
body: JSON.stringify({
username,
password
})
});

```
localStorage.setItem("me", JSON.stringify(me));

render();
```

} catch (error) {
alert(error.message);
}
}

async function sendActivity() {
if (!me?.id) return;

try {
const result = await api("/api/activity", {
method: "POST",
body: JSON.stringify({
user_id: me.id
})
});

```
me.last_seen = result.last_seen;
localStorage.setItem("me", JSON.stringify(me));
```

} catch (error) {
if (
error.message.includes("موقوف") ||
error.message.includes("الحساب")
) {
logout();
}
}
}

async function render() {
if (!me) {
loginPage();
return;
}

await sendActivity();

if (me.role === "admin") {
return adminPage();
}

if (me.role === "teacher") {
return teacherPage();
}

if (me.role === "parent") {
return parentPage();
}

if (me.role === "student") {
return studentPage();
}

app.innerHTML = `     <div class="wrap">       <h1>حساب غير معروف</h1>       <button onclick="logout()">خروج</button>     </div>
  `;
}

/* =========================================================
ADMIN
========================================================= */

async function adminPage() {
try {
const [students, users] = await Promise.all([
api("/api/students"),
api("/api/users")
]);

```
const present = students.filter(
  x => x.status === "حاضر"
).length;

const absent = students.filter(
  x => x.status === "غائب"
).length;

const online = users.filter(
  x => x.online
).length;

app.innerHTML = `
  <div class="wrap">

    <div class="page-title">
      <div>
        <h1>لوحة الإدارة</h1>
        <p>مرحباً ${escapeHtml(me.name)}</p>
      </div>

      <button onclick="logout()">خروج</button>
    </div>

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

    <section class="panel">

      <h2>👥 إدارة المستخدمين</h2>

      <h3>إضافة مستخدم جديد</h3>

      <div class="form row">

        <input
          id="newUserName"
          placeholder="الاسم">

        <input
          id="newUsername"
          placeholder="اسم المستخدم">

        <input
          id="newPassword"
          placeholder="كلمة المرور"
          type="password">

        <select id="newRole">

          <option value="teacher">مدرس</option>
          <option value="parent">ولي أمر</option>
          <option value="student">طالب</option>
          <option value="admin">مدير</option>

        </select>

        <button onclick="addUser()">
          ➕ إضافة المستخدم
        </button>

      </div>

      <div style="overflow-x:auto">

        <table class="table">

          <tr>
            <th>الاسم</th>
            <th>اسم المستخدم</th>
            <th>الصلاحية</th>
            <th>الحالة</th>
            <th>آخر نشاط</th>
            <th>إجراء</th>
          </tr>

          ${
            users.map(user => {

              const status = !user.active
                ? `<b>🔴 موقوف</b>`
                : user.online
                  ? `<b>🟢 متصل الآن</b>`
                  : `⚪ غير متصل`;

              let action = "";

              if (user.username === "admin") {

                action = `<b>المدير الرئيسي</b>`;

              } else {

                action = user.active
                  ? `
                    <button
                      onclick="disableUser(${user.id})">
                      ⛔ إيقاف
                    </button>
                  `
                  : `
                    <button
                      onclick="enableUser(${user.id})">
                      ✅ تفعيل
                    </button>
                  `;

                action += `
                  <button
                    onclick="deleteUser(${user.id})">
                    🗑️ حذف
                  </button>
                `;
              }

              return `
                <tr>

                  <td>
                    ${escapeHtml(user.name)}
                  </td>

                  <td>
                    ${escapeHtml(user.username)}
                  </td>

                  <td>
                    ${roleName(user.role)}
                  </td>

                  <td>
                    ${status}
                  </td>

                  <td>
                    ${formatDate(user.last_seen)}
                  </td>

                  <td>
                    ${action}
                  </td>

                </tr>
              `;
            }).join("")
          }

        </table>

      </div>

    </section>

    <section class="panel">

      <h2>👨‍🎓 إدارة الطلاب</h2>

      <div style="overflow-x:auto">

        <table class="table">

          <tr>
            <th>الاسم</th>
            <th>الفصل</th>
            <th>الحالة</th>
            <th>WhatsApp ولي الأمر</th>
            <th>إجراء</th>
          </tr>

          ${
            students.map(student => `

              <tr>

                <td>
                  ${escapeHtml(student.name)}
                </td>

                <td>
                  ${escapeHtml(student.class_name)}
                </td>

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

                <td>

                  <button
                    onclick="editStudent(${student.id})">
                    ✏️ تعديل
                  </button>

                  <button
                    onclick="deleteStudent(${student.id})">
                    🗑️ حذف
                  </button>

                </td>

              </tr>

            `).join("")
          }

        </table>

      </div>

    </section>

    <section class="panel">

      <h2>➕ إضافة طالب</h2>

      <div class="form row">

        <input
          id="studentName"
          placeholder="اسم الطالب">

        <input
          id="studentClass"
          placeholder="الفصل">

        <input
          id="studentPhone"
          placeholder="رقم WhatsApp ولي الأمر">

        <button onclick="addStudent()">
          إضافة الطالب
        </button>

      </div>

    </section>

  </div>
`;
```

} catch (error) {

```
app.innerHTML = `
  <div class="wrap">
    <h2>حدث خطأ</h2>
    <div class="notice">
      ${escapeHtml(error.message)}
    </div>
    <button onclick="adminPage()">
      إعادة المحاولة
    </button>
  </div>
`;
```

}
}

/* =========================================================
USERS
========================================================= */

async function addUser() {

const name =
document.getElementById("newUserName").value.trim();

const username =
document.getElementById("newUsername").value.trim();

const password =
document.getElementById("newPassword").value;

const role =
document.getElementById("newRole").value;

if (!name || !username || !password || !role) {
alert("أكمل جميع بيانات المستخدم");
return;
}

try {

```
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

adminPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

async function disableUser(id) {

if (!confirm("هل تريد إيقاف هذا المستخدم؟")) {
return;
}

try {

```
await api(`/api/users/${id}/disable`, {
  method: "PATCH"
});

adminPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

async function enableUser(id) {

try {

```
await api(`/api/users/${id}/enable`, {
  method: "PATCH"
});

adminPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

async function deleteUser(id) {

if (!confirm("هل أنت متأكد من حذف المستخدم؟")) {
return;
}

try {

```
await api(`/api/users/${id}`, {
  method: "DELETE"
});

adminPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

/* =========================================================
STUDENTS
========================================================= */

async function addStudent() {

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

try {

```
await api("/api/students", {
  method: "POST",
  body: JSON.stringify({
    name,
    class_name: className,
    parent_phone: phone
  })
});

alert("تم إضافة الطالب بنجاح");

adminPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

async function deleteStudent(id) {

if (!confirm(
"هل أنت متأكد من حذف الطالب؟"
)) {
return;
}

try {

```
await api(`/api/students/${id}`, {
  method: "DELETE"
});

adminPage();
```

} catch (error) {

```
alert(
  "السيرفر الحالي لا يحتوي على أمر حذف الطالب. سنضيفه في الخطوة التالية."
);
```

}
}

async function editStudent(id) {

const students =
await api("/api/students");

const student =
students.find(x => Number(x.id) === Number(id));

if (!student) {
alert("الطالب غير موجود");
return;
}

const name = prompt(
"اسم الطالب:",
student.name
);

if (name === null) return;

const className = prompt(
"الفصل:",
student.class_name
);

if (className === null) return;

const phone = prompt(
"رقم WhatsApp ولي الأمر:",
student.parent_phone
);

if (phone === null) return;

try {

```
await api(`/api/students/${id}`, {
  method: "PATCH",
  body: JSON.stringify({
    name,
    class_name: className,
    parent_phone: phone
  })
});

alert("تم تعديل بيانات الطالب");

adminPage();
```

} catch (error) {

```
alert(
  "السيرفر الحالي يحتاج إضافة API تعديل الطالب."
);
```

}
}

/* =========================================================
TEACHER
========================================================= */

async function teacherPage() {

const students =
await api("/api/students");

app.innerHTML = `

```
<div class="wrap">

  <div class="page-title">

    <div>
      <h1>👨‍🏫 بوابة المدرس</h1>
      <p>
        ${escapeHtml(me.name)}
      </p>
    </div>

    <button onclick="logout()">
      خروج
    </button>

  </div>

  <section class="panel">

    <h2>📋 الحضور والغياب</h2>

    <div style="overflow-x:auto">

      <table class="table">

        <tr>
          <th>الطالب</th>
          <th>الفصل</th>
          <th>الحالة</th>
          <th>الإجراء</th>
        </tr>

        ${
          students.map(student => `

            <tr>

              <td>
                ${escapeHtml(student.name)}
              </td>

              <td>
                ${escapeHtml(student.class_name)}
              </td>

              <td>
                ${
                  student.status === "حاضر"
                    ? "🟢 حاضر"
                    : "🔴 غائب"
                }
              </td>

              <td>

                <button
                  onclick="toggleStatus(${student.id})">
                  تغيير الحالة
                </button>

              </td>

            </tr>

          `).join("")
        }

      </table>

    </div>

  </section>

  <section class="panel">

    <h2>📝 ملاحظة لولي الأمر</h2>

    <select id="noteStudent">

      ${
        students.map(student => `
          <option value="${student.id}">
            ${escapeHtml(student.name)}
          </option>
        `).join("")
      }

    </select>

    <textarea
      id="noteText"
      placeholder="اكتب الملاحظة اليومية">
    </textarea>

    <button onclick="saveNote()">
      💾 حفظ الملاحظة
    </button>

    <div class="notice">
      الملاحظة تحفظ داخل النظام.
      ربط الإرسال الفعلي عبر WhatsApp يحتاج
      WhatsApp Business API.
    </div>

  </section>

  <section class="panel">

    <h2>🎥 الحصص والفيديوهات</h2>

    <input
      id="videoTitle"
      placeholder="اسم المادة والحصة">

    <input
      id="videoFile"
      type="file"
      accept="video/*">

    <button onclick="saveVideo()">
      حفظ بيانات الحصة
    </button>

    <div class="notice">
      حالياً يتم حفظ اسم الفيديو فقط.
      رفع الفيديو فعلياً يحتاج تخزيناً سحابياً.
    </div>

  </section>

</div>
```

`;
}

async function toggleStatus(id) {

try {

```
await api(
  `/api/students/${id}/status`,
  {
    method: "PATCH"
  }
);

teacherPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

async function saveNote() {

const studentId =
document.getElementById("noteStudent").value;

const text =
document.getElementById("noteText").value.trim();

if (!text) {
alert("اكتب الملاحظة");
return;
}

try {

```
await api("/api/notes", {
  method: "POST",
  body: JSON.stringify({
    student_id: Number(studentId),
    text
  })
});

alert("تم حفظ الملاحظة");

teacherPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

async function saveVideo() {

const title =
document.getElementById("videoTitle").value.trim();

const file =
document.getElementById("videoFile").files[0];

if (!title) {
alert("اكتب اسم الحصة");
return;
}

try {

```
await api("/api/videos", {
  method: "POST",
  body: JSON.stringify({
    title,
    file_name: file ? file.name : ""
  })
});

alert("تم حفظ بيانات الحصة");

document.getElementById("videoTitle").value = "";
document.getElementById("videoFile").value = "";
```

} catch (error) {

```
alert(error.message);
```

}
}

/* =========================================================
PARENT
========================================================= */

async function parentPage() {

const students =
await api("/api/students");

if (!students.length) {

```
app.innerHTML = `
  <div class="wrap">

    <h1>👨‍👩‍👦 بوابة ولي الأمر</h1>

    <div class="notice">
      لا يوجد طالب مرتبط بهذا الحساب حالياً.
    </div>

    <button onclick="logout()">
      خروج
    </button>

  </div>
`;

return;
```

}

let student = students[0];

const notes =
await api(`/api/notes/${student.id}`);

const videos =
await api("/api/videos");

app.innerHTML = `

```
<div class="wrap">

  <div class="page-title">

    <div>
      <h1>👨‍👩‍👦 بوابة ولي الأمر</h1>
      <p>
        ${escapeHtml(me.name)}
      </p>
    </div>

    <button onclick="logout()">
      خروج
    </button>

  </div>

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

      حالة الطالب

      <div class="num">
        ${
          student.status === "حاضر"
            ? "🟢 حاضر"
            : "🔴 غائب"
        }
      </div>

    </div>

  </div>

  <section class="panel">

    <h2>📝 ملاحظات المدرسة</h2>

    ${
      notes.length
        ? notes.map(note => `

          <div class="notice">

            <b>
              ${escapeHtml(note.created_at)}
            </b>

            <br><br>

            ${escapeHtml(note.text)}

          </div>

        `).join("")
        : `
          <div class="card">
            لا توجد ملاحظات حالياً.
          </div>
        `
    }

  </section>

  <section class="panel">

    <h2>🎥 الحصص</h2>

    ${
      videos.length
        ? videos.map(video => `

          <div class="card">

            🎥
            ${escapeHtml(video.title)}

            <br>

            <small>
              ${escapeHtml(video.created_at)}
            </small>

          </div>

        `).join("")
        : `
          <div class="card">
            لا توجد حصص حالياً.
          </div>
        `
    }

  </section>

</div>
```

`;
}

/* =========================================================
STUDENT
========================================================= */

async function studentPage() {

const students =
await api("/api/students");

const student =
students.find(
x =>
x.name === me.name
) || students[0];

if (!student) {

```
app.innerHTML = `
  <div class="wrap">
    <h1>بوابة الطالب</h1>

    <div class="notice">
      لم يتم العثور على بيانات الطالب.
    </div>

    <button onclick="logout()">
      خروج
    </button>
  </div>
`;

return;
```

}

const notes =
await api(`/api/notes/${student.id}`);

const videos =
await api("/api/videos");

app.innerHTML = `

```
<div class="wrap">

  <div class="page-title">

    <div>

      <h1>🎓 بوابة الطالب</h1>

      <p>
        ${escapeHtml(me.name)}
      </p>

    </div>

    <button onclick="logout()">
      خروج
    </button>

  </div>

  <div class="cards">

    <div class="card">

      الاسم

      <div class="num">
        ${escapeHtml(student.name)}
      </div>

    </div>

    <div class="card">

      الفصل

      <div class="num">
        ${escapeHtml(student.class_name)}
      </div>

    </div>

    <div class="card">

      الحضور

      <div class="num">
        ${
          student.status === "حاضر"
            ? "🟢 حاضر"
            : "🔴 غائب"
        }
      </div>

    </div>

  </div>

  <section class="panel">

    <h2>📝 ملاحظات المدرسين</h2>

    ${
      notes.length
        ? notes.map(note => `

          <div class="notice">

            <b>
              ${escapeHtml(note.created_at)}
            </b>

            <br><br>

            ${escapeHtml(note.text)}

          </div>

        `).join("")
        : `
          <div class="card">
            لا توجد ملاحظات.
          </div>
        `
    }

  </section>

  <section class="panel">

    <h2>🎥 الحصص التعليمية</h2>

    ${
      videos.length
        ? videos.map(video => `

          <div class="card">

            🎥
            ${escapeHtml(video.title)}

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

  </section>

</div>
```

`;
}

/* =========================================================
AUTO ACTIVITY
========================================================= */

setInterval(async () => {

if (!me) return;

try {

```
await sendActivity();
```

} catch (error) {}

}, 30000);

/* =========================================================
START
========================================================= */

try {

me = JSON.parse(
localStorage.getItem("me") || "null"
);

} catch (error) {

me = null;
localStorage.removeItem("me");

}

render();
