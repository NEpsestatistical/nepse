#!/usr/bin/env node
/**
 * Build script: assembles portfolio.html from the shell + view partials.
 * No dependencies, no bundler — just string concatenation in the right order.
 *
 * Usage:  node build.js
 * Run this after editing anything in shell-top.html, shell-bottom.html,
 * or views/*.html, then commit the regenerated portfolio.html.
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\n$/, "");

const VIEW_ORDER = [
  "views/overview.html",
  "views/activity.html",
  "views/analysis.html",
  "views/watchlist.html",
  "views/alerts.html",
  "views/settings.html",
  "views/holdings.html",
];

const parts = [
  read("shell-top.html"),
  ...VIEW_ORDER.map(read),
  read("shell-bottom.html"),
];

const output = parts.join("\n") + "\n";
fs.writeFileSync(path.join(ROOT, "portfolio.html"), output);
console.log(`Built portfolio.html (${output.split("\n").length} lines) from ${VIEW_ORDER.length} view partials.`);
