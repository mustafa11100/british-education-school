const loginBox =
  document.getElementById("loginBox");

const registerBox =
  document.getElementById("registerBox");

const showRegisterButton =
  document.getElementById("showRegisterButton");

const backToLoginButton =
  document.getElementById("backToLoginButton");

const registerForm =
  document.getElementById("registerForm");

const registerMessage =
  document.getElementById("registerMessage");


/* فتح صفحة إنشاء الحساب */

showRegisterButton.addEventListener(
  "click",
  () => {

    loginBox.classList.add("hidden");

    registerBox.classList.remove("hidden");

    registerMessage.textContent = "";

  }
);


/* الرجوع لتسجيل الدخول */

backToLoginButton.addEventListener(
  "click",
  () => {

    registerBox.classList.add("hidden");

    loginBox.classList.remove("hidden");

    registerMessage.textContent = "";

  }
);


/* إنشاء الحساب */

registerForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    const name =
      document
        .getElementById("registerName")
        .value
        .trim();

    const username =
      document
        .getElementById("registerUsername")
        .value
        .trim();

    const password =
      document
        .getElementById("registerPassword")
        .value;

    const confirmPassword =
      document
        .getElementById("registerPasswordConfirm")
        .value;


    if (!name || !username || !password) {

      registerMessage.textContent =
        "أكمل جميع البيانات";

      return;
    }


    if (password.length < 4) {

      registerMessage.textContent =
        "كلمة المرور يجب أن تكون 4 أحرف على الأقل";

      return;
    }


    if (password !== confirmPassword) {

      registerMessage.textContent =
        "كلمتا المرور غير متطابقتين";

      return;
    }


    registerMessage.textContent =
      "جاري إنشاء الحساب...";


    try {

      const response =
        await fetch("/api/users", {

          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({

            username,
            password,
            name,

            // أي تسجيل ذاتي = مستخدم عادي
            role: "user"

          })

        });


      const data =
        await response.json();


      if (!response.ok) {

        registerMessage.textContent =
          data.error ||
          "تعذر إنشاء الحساب";

        return;
      }


      registerMessage.textContent =
        "تم إنشاء الحساب بنجاح ✅";


      registerForm.reset();


      setTimeout(() => {

        registerBox.classList.add("hidden");

        loginBox.classList.remove("hidden");

        document
          .getElementById("username")
          .value = username;

        document
          .getElementById("password")
          .value = "";

        registerMessage.textContent = "";

      }, 1000);


    } catch (error) {

      console.error(error);

      registerMessage.textContent =
        "تعذر الاتصال بالسيرفر";

    }

  }
);
