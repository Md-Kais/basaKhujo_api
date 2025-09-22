"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const client_1 = require("@prisma/client");
const promises_1 = require("fs/promises");
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
async function tryLoadJSON(relativeFile) {
    try {
        const p = path.join(__dirname, 'data', relativeFile);
        const text = await (0, promises_1.readFile)(p, 'utf8');
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
// ---- Inline fallback dataset (covers all 8 divisions + useful districts/upazilas)
// NOTE: IDs are consistent internally; key chain kept for you: 6/36/301
function inlineData() {
    const divisions = [
        { id: 1, name: 'Barishal', bnName: 'বরিশাল', url: null },
        { id: 2, name: 'Chattogram', bnName: 'চট্টগ্রাম', url: null },
        { id: 3, name: 'Dhaka', bnName: 'ঢাকা', url: null },
        { id: 4, name: 'Khulna', bnName: 'খুলনা', url: null },
        { id: 5, name: 'Rajshahi', bnName: 'রাজশাহী', url: null },
        { id: 6, name: 'Rangpur', bnName: 'রংপুর', url: null },
        { id: 7, name: 'Sylhet', bnName: 'সিলেট', url: null },
        { id: 8, name: 'Mymensingh', bnName: 'ময়মনসিংহ', url: null },
    ];
    const districts = [
        // Dhaka (3)
        { id: 101, divisionId: 3, name: 'Dhaka', bnName: 'ঢাকা', lat: null, lon: null, url: null },
        { id: 102, divisionId: 3, name: 'Gazipur', bnName: 'গাজীপুর', lat: null, lon: null, url: null },
        { id: 103, divisionId: 3, name: 'Narayanganj', bnName: 'নারায়ণগঞ্জ', lat: null, lon: null, url: null },
        // Chattogram (2)
        { id: 201, divisionId: 2, name: 'Chattogram', bnName: 'চট্টগ্রাম', lat: null, lon: null, url: null },
        { id: 202, divisionId: 2, name: 'Cox\'s Bazar', bnName: 'কক্সবাজার', lat: null, lon: null, url: null },
        // Khulna (4)
        { id: 401, divisionId: 4, name: 'Khulna', bnName: 'খুলনা', lat: null, lon: null, url: null },
        { id: 402, divisionId: 4, name: 'Jashore', bnName: 'যশোর', lat: null, lon: null, url: null },
        // Rajshahi (5)
        { id: 501, divisionId: 5, name: 'Rajshahi', bnName: 'রাজশাহী', lat: null, lon: null, url: null },
        { id: 502, divisionId: 5, name: 'Pabna', bnName: 'পাবনা', lat: null, lon: null, url: null },
        // Sylhet (7)
        { id: 701, divisionId: 7, name: 'Sylhet', bnName: 'সিলেট', lat: null, lon: null, url: null },
        { id: 702, divisionId: 7, name: 'Moulvibazar', bnName: 'মৌলভীবাজার', lat: null, lon: null, url: null },
        // Barishal (1)
        { id: 901, divisionId: 1, name: 'Barishal', bnName: 'বরিশাল', lat: null, lon: null, url: null },
        { id: 902, divisionId: 1, name: 'Patuakhali', bnName: 'পটুয়াখালী', lat: null, lon: null, url: null },
        // Mymensingh (8)
        { id: 1101, divisionId: 8, name: 'Mymensingh', bnName: 'ময়মনসিংহ', lat: null, lon: null, url: null },
        { id: 1102, divisionId: 8, name: 'Jamalpur', bnName: 'জামালপুর', lat: null, lon: null, url: null },
        // Rangpur (6) — includes your required district id=36
        { id: 36, divisionId: 6, name: 'Nilphamari', bnName: 'নীলফামারী', lat: null, lon: null, url: null },
        { id: 362, divisionId: 6, name: 'Rangpur', bnName: 'রংপুর', lat: null, lon: null, url: null },
    ];
    const upazilas = [
        // Dhaka
        { id: 2001, districtId: 101, name: 'Dhanmondi', bnName: 'ধানমন্ডি', url: null },
        { id: 2002, districtId: 101, name: 'Tejgaon', bnName: 'তেজগাঁও', url: null },
        { id: 2101, districtId: 102, name: 'Sreepur', bnName: 'শ্রীপুর', url: null },
        { id: 2102, districtId: 102, name: 'Tongi', bnName: 'টঙ্গী', url: null },
        { id: 2201, districtId: 103, name: 'Sonargaon', bnName: 'সোনারগাঁও', url: null },
        { id: 2202, districtId: 103, name: 'Araihazar', bnName: 'আড়াইহাজার', url: null },
        // Chattogram
        { id: 3001, districtId: 201, name: 'Pahartali', bnName: 'পাহাড়তলী', url: null },
        { id: 3002, districtId: 201, name: 'Kotwali', bnName: 'কোতোয়ালী', url: null },
        { id: 3101, districtId: 202, name: 'Teknaf', bnName: 'টেকনাফ', url: null },
        { id: 3102, districtId: 202, name: 'Ukhia', bnName: 'উখিয়া', url: null },
        // Khulna
        { id: 4001, districtId: 401, name: 'Khalishpur', bnName: 'খালিশপুর', url: null },
        { id: 4002, districtId: 401, name: 'Daulatpur', bnName: 'দৌলতপুর', url: null },
        { id: 4101, districtId: 402, name: 'Jessore Sadar', bnName: 'যশোর সদর', url: null },
        { id: 4102, districtId: 402, name: 'Manirampur', bnName: 'মণিরামপুর', url: null },
        // Rajshahi
        { id: 5001, districtId: 501, name: 'Rajpara', bnName: 'রাজপাড়া', url: null },
        { id: 5002, districtId: 501, name: 'Motihar', bnName: 'মতিহার', url: null },
        { id: 5101, districtId: 502, name: 'Pabna Sadar', bnName: 'পাবনা সদর', url: null },
        { id: 5102, districtId: 502, name: 'Ishwardi', bnName: 'ইশ্বরদী', url: null },
        // Sylhet
        { id: 7001, districtId: 701, name: 'Sylhet Sadar', bnName: 'সিলেট সদর', url: null },
        { id: 7002, districtId: 701, name: 'Beanibazar', bnName: 'বিয়ানীবাজার', url: null },
        { id: 7101, districtId: 702, name: 'Sreemangal', bnName: 'শ্রীমঙ্গল', url: null },
        { id: 7102, districtId: 702, name: 'Kamalganj', bnName: 'কামালগঞ্জ', url: null },
        // Barishal
        { id: 9001, districtId: 901, name: 'Barishal Sadar', bnName: 'বরিশাল সদর', url: null },
        { id: 9002, districtId: 901, name: 'Uzirpur', bnName: 'উজিরপুর', url: null },
        { id: 9101, districtId: 902, name: 'Patuakhali Sadar', bnName: 'পটুয়াখালী সদর', url: null },
        { id: 9102, districtId: 902, name: 'Dumki', bnName: 'দুমকি', url: null },
        // Mymensingh
        { id: 11001, districtId: 1101, name: 'Mymensingh Sadar', bnName: 'ময়মনসিংহ সদর', url: null },
        { id: 11002, districtId: 1101, name: 'Trishal', bnName: 'ত্রিশাল', url: null },
        { id: 11101, districtId: 1102, name: 'Jamalpur Sadar', bnName: 'জামালপুর সদর', url: null },
        { id: 11102, districtId: 1102, name: 'Dewanganj', bnName: 'দেওয়ানগঞ্জ', url: null },
        // Rangpur — keep your known IDs
        { id: 301, districtId: 36, name: 'Nilphamari Sadar', bnName: 'নীলফামারী সদর', url: null },
        { id: 302, districtId: 36, name: 'Saidpur', bnName: 'সৈয়দপুর', url: null },
        { id: 3601, districtId: 362, name: 'Rangpur Sadar', bnName: 'রংপুর সদর', url: null },
        { id: 3602, districtId: 362, name: 'Gangachara', bnName: 'গংগাচড়া', url: null },
    ];
    return { divisions, districts, upazilas };
}
async function main() {
    // 1) Load JSON if present, else fallback to inline
    const [divisionsJson, districtsJson, upazilasJson] = await Promise.all([
        tryLoadJSON('divisions.json'),
        tryLoadJSON('districts.json'),
        tryLoadJSON('upazilas.json'),
    ]);
    const fallback = inlineData();
    const divisions = (divisionsJson?.map(d => ({
        id: d.id, name: d.name, bnName: d.bn_name ?? d.bnName ?? null, url: d.url ?? null
    })) ?? fallback.divisions);
    const districts = (districtsJson?.map(d => ({
        id: d.id,
        divisionId: d.division_id ?? d.divisionId,
        name: d.name,
        bnName: d.bn_name ?? d.bnName ?? null,
        lat: d.lat ?? null,
        lon: d.lon ?? null,
        url: d.url ?? null
    })) ?? fallback.districts);
    const upazilas = (upazilasJson?.map(u => ({
        id: u.id,
        districtId: u.district_id ?? u.districtId,
        name: u.name,
        bnName: u.bn_name ?? u.bnName ?? null,
        url: u.url ?? null
    })) ?? fallback.upazilas);
    // 2) Seed in parent → child order (FK safe)
    await prisma.division.createMany({ data: divisions, skipDuplicates: true });
    await prisma.district.createMany({ data: districts, skipDuplicates: true });
    await prisma.upazila.createMany({ data: upazilas, skipDuplicates: true });
    // 3) Sanity check: ensure the known chain exists
    const div = await prisma.division.findUnique({ where: { id: 6 } });
    const dist = await prisma.district.findUnique({ where: { id: 36 } });
    const upa = await prisma.upazila.findUnique({ where: { id: 301 } });
    console.log('✅ Seeded Bangladesh locations.');
    console.log('Check:', { divisionId6: !!div, districtId36: !!dist, upazilaId301: !!upa });
}
main()
    .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
