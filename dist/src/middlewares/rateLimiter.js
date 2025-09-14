"use strict";
// import { prisma } from '../db/prisma    ';
// import { readFile } from 'fs/promises';
// import * as path from 'path';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authLimiter = exports.rateLimiter = void 0;
// async function loadJSON(relativeFile: string) {
//   const p = path.join(__dirname, 'data', relativeFile);
//   const text = await readFile(p, 'utf8');
//   return JSON.parse(text);
// }
// async function main() {
//   const divisions = await loadJSON('divisions.json');
//   const districts = await loadJSON('districts.json');
//   const upazilas  = await loadJSON('upazilas.json');
//   await prisma.division.createMany({
//     data: divisions.map((d: any) => ({ id: d.id, name: d.name, bnName: d.bn_name, url: d.url })),
//     skipDuplicates: true
//   });
//   await prisma.district.createMany({
//     data: districts.map((d: any) => ({
//       id: d.id, divisionId: d.division_id, name: d.name, bnName: d.bn_name, lat: d.lat, lon: d.lon, url: d.url
//     })),
//     skipDuplicates: true
//   });
//   await prisma.upazila.createMany({
//     data: upazilas.map((u: any) => ({
//       id: u.id, districtId: u.district_id, name: u.name, bnName: u.bn_name, url: u.url
//     })),
//     skipDuplicates: true
//   });
//   console.log('Seeded Bangladesh locations.');
// }
// main().catch((e) => { console.error(e); process.exit(1); });
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.rateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
});
// Tighter limiter for auth endpoints (optional export if you want)
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false
});
