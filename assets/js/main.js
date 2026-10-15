/* ==========================================================================
   zr 官网 —— 交互脚本
   1. 主题切换（暗/亮，带本地持久化）
   2. 移动端导航
   3. 本页目录（从正文标题自动生成 + 滚动高亮）
   4. 代码块复制按钮 / 安装页签
   ========================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "zr-theme";

  /* ---------------------------------------------------------------- 主题 */
  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* 隐私模式下忽略 */
    }
  }

  function preferredTheme() {
    var stored = getStoredTheme();
    if (stored === "dark" || stored === "light") return stored;
    try {
      if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
    } catch (e) {
      /* 老浏览器忽略 */
    }
    return "dark";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#14110f" : "#fdfbfa");
  }

  applyTheme(preferredTheme());

  function initTheme() {
    var toggle = document.getElementById("theme-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", function () {
      var next =
        document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      storeTheme(next);
    });
  }

  /* ------------------------------------------------------------ 移动导航 */
  function initNav() {
    var toggle = document.getElementById("nav-toggle");
    var nav = document.getElementById("site-nav");
    var backdrop = document.getElementById("nav-backdrop");
    if (!toggle || !nav) return;

    function open() {
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      if (backdrop) backdrop.hidden = false;
      document.body.style.overflow = "hidden";
    }

    function close() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      if (backdrop) backdrop.hidden = true;
      document.body.style.overflow = "";
    }

    toggle.addEventListener("click", function () {
      if (toggle.getAttribute("aria-expanded") === "true") close();
      else open();
    });

    if (backdrop) backdrop.addEventListener("click", close);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") close();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1024) close();
    });
  }

  /* -------------------------------------------------------- 标题锚点链接 */
  function addHeadingAnchors() {
    var prose = document.querySelector(".prose");
    if (!prose) return;

    var headings = prose.querySelectorAll("h2[id], h3[id], h4[id]");
    Array.prototype.forEach.call(headings, function (h) {
      if (h.querySelector(".heading-anchor")) return;
      var a = document.createElement("a");
      a.className = "heading-anchor";
      a.href = "#" + h.id;
      a.setAttribute("aria-hidden", "true");
      a.tabIndex = -1;
      a.textContent = "#";
      h.appendChild(a);
    });
  }

  /* ------------------------------------------------------------- 本页目录 */
  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w一-龥\- ]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  function ensureIds(headings) {
    var seen = {};
    Array.prototype.forEach.call(headings, function (h) {
      if (h.id) return;
      var base = slugify(h.textContent) || "section";
      var id = base;
      var n = 1;
      while (seen[id]) {
        n += 1;
        id = base + "-" + n;
      }
      seen[id] = true;
      h.id = id;
    });
  }

  function initToc() {
    var toc = document.getElementById("page-toc");
    var list = document.getElementById("page-toc-list");
    var prose = document.querySelector(".prose");
    if (!toc || !list || !prose) return;

    var headings = prose.querySelectorAll("h2, h3");
    if (headings.length < 2) return;

    ensureIds(headings);

    var current = null;

    Array.prototype.forEach.call(headings, function (h) {
      var li = document.createElement("li");
      li.className = h.tagName === "H3" ? "toc-h3" : "toc-h2";
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent.replace(/#$/, "").trim();
      li.appendChild(a);
      list.appendChild(li);

      current = current || a;
    });

    toc.hidden = false;

    var links = list.querySelectorAll("a");

    function setCurrent(a) {
      if (current === a) return;
      if (current) current.classList.remove("is-current");
      current = a;
      if (a) a.classList.add("is-current");
    }

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var a = links[
                Array.prototype.indexOf.call(headings, entry.target)
              ];
              setCurrent(a);
            }
          });
        },
        { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
      );

      Array.prototype.forEach.call(headings, function (h) {
        observer.observe(h);
      });
    }

    setCurrent(links[0]);
  }

  /* ------------------------------------------------------------ 代码复制 */
  function initCopyButtons() {
    // kramdown 的围栏代码块外层是 .highlighter-rouge，{% highlight %} 是 figure.highlight
    var blocks = document.querySelectorAll(
      ".prose .highlighter-rouge, .prose figure.highlight, .install-tab-panel figure.highlight"
    );

    Array.prototype.forEach.call(blocks, function (block) {
      var code = block.querySelector("pre");
      if (!code || block.querySelector(":scope > .copy-btn")) return;

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-btn";
      btn.textContent = "复制";
      btn.setAttribute("aria-label", "复制代码");

      btn.addEventListener("click", function () {
        var text = code.innerText;
        var done = function () {
          btn.textContent = "已复制";
          btn.classList.add("is-done");
          setTimeout(function () {
            btn.textContent = "复制";
            btn.classList.remove("is-done");
          }, 1600);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () {});
        } else {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "absolute";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand("copy");
            done();
          } catch (e) {
            /* 忽略 */
          }
          document.body.removeChild(ta);
        }
      });

      block.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------ 安装页签 */
  function initTabs() {
    var wrap = document.querySelector("[data-tabs]");
    if (!wrap) return;

    var tabs = wrap.querySelectorAll("[data-tab]");
    var panels = wrap.querySelectorAll("[data-panel]");

    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener("click", function () {
        var name = tab.getAttribute("data-tab");
        Array.prototype.forEach.call(tabs, function (t) {
          var on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        Array.prototype.forEach.call(panels, function (p) {
          var on = p.getAttribute("data-panel") === name;
          p.hidden = !on;
          p.classList.toggle("is-active", on);
        });
      });
    });
  }

  /* ------------------------------------------------------------- 初始化 */
  function boot() {
    initTheme();
    initNav();
    addHeadingAnchors();
    initToc();
    initCopyButtons();
    initTabs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();