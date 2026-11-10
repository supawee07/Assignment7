# Sepolia Bank · Assignment 5

DApp สำหรับฝาก ถอน และเช็คยอด ETH ที่บัญชีฝากไว้ใน Smart Contract บน Sepolia โดยใช้ MetaMask

## 1. Deploy และ Verify ด้วย Remix

1. เปิด [Remix IDE](https://remix.ethereum.org/) แล้วสร้างไฟล์ `Bank.sol` จากไฟล์ในโปรเจกต์นี้ โจทย์อ้างถึงสัญญาที่อาจารย์กำหนด แต่ PDF ไม่มีโค้ดสัญญาแนบมาด้วย จึงมีสัญญาตัวอย่างให้ใช้ หากได้รับสัญญาต้นฉบับ ให้เทียบฟังก์ชันและหน่วยตามหัวข้อด้านล่าง
2. ใน **Solidity Compiler** เลือก compiler **0.8.28** แล้ว Compile `Bank.sol` จดค่า optimizer และ EVM version ไว้ใช้ตอน Verify
3. เปิด MetaMask และเลือก **Sepolia** (chain ID `11155111`) บัญชีต้องมี Sepolia ETH สำหรับค่า gas
4. ใน **Deploy & Run Transactions** เลือก **Browser Extension** (Remix รุ่นเก่าอาจเรียก **Injected Provider**) ตรวจว่าเครือข่ายคือ Sepolia เลือก contract **Bank** ตั้ง **Value = 0** แล้วกด Deploy และยืนยันใน MetaMask
5. คัดลอก **Contract address** จากรายการ **Deployed Contracts** และคัดลอก **ABI** จาก **Solidity Compiler → Compilation Details → ABI**
6. ตรวจ transaction และ contract address บน [Sepolia Etherscan](https://sepolia.etherscan.io/). หากต้องการให้แท็บ Contract แสดงซอร์สที่ Verify แล้ว ให้เปิด **Contract Verification** ใน Remix เลือก Etherscan ใส่ Etherscan API key ใน Settings ของปลั๊กอิน และ Verify ด้วยการตั้งค่าเดิม ตรวจผลใน **Receipts**

อ้างอิง [Deploy & Run](https://remix-ide.readthedocs.io/en/latest/run.html) และ [Contract Verification](https://remix-ide.readthedocs.io/en/latest/contract_verification.html)

## 2. ตั้งค่า Infura และเว็บ

สถาปัตยกรรมอ้างอิงจาก Web3.js Architecture Blueprint โดยใช้ `JsonRpcProvider` ของ ethers.js เป็น HTTP gateway ไปยัง `https://sepolia.infura.io/v3/<API_KEY>` เว็บใช้ ABI และ address จาก Remix เพื่อเช็คยอดผ่าน Infura โดยส่ง address ของบัญชี MetaMask ในช่อง `from` ของ `eth_call` ส่วนธุรกรรมฝากและถอนให้ MetaMask ลงนามและส่งบน Sepolia

ทดสอบในเครื่องจากโฟลเดอร์โปรเจกต์ด้วยคำสั่ง:

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory .
```

เปิด http://127.0.0.1:8000 ในเบราว์เซอร์ที่ติดตั้ง MetaMask

- สร้าง API Key ที่เปิดใช้ Ethereum Sepolia ใน Infura แล้วกรอกในเมนู **ตั้งค่า Infura, Contract และข้อมูลนักศึกษา** พร้อมตรวจ address และ ABI JSON จาก Remix ค่าที่บันทึกผ่านฟอร์มอยู่ในเบราว์เซอร์นั้น ใช้เฉพาะ API Key สำหรับเรียก RPC จากเบราว์เซอร์ ส่วน Private Key ของบัญชีเก็บอยู่ใน MetaMask
- เมื่อเผยแพร่เว็บ ผู้ตรวจสามารถใส่ Infura API Key ของตนเองได้ หากต้องการตั้งค่าเริ่มต้นใน `config.js` ให้ใช้คีย์ที่ตั้งใจเผยแพร่และจำกัดให้ใช้กับโดเมนของเว็บ เพราะค่าในไฟล์นี้จะเปิดให้ผู้ชมอ่านได้
- ก่อนเผยแพร่ กรอก `studentId`, `studentName`, `address` และวาง JSON array ลงใน `abi` ในไฟล์ `config.js` เพื่อให้ผู้ตรวจงานได้รับค่าเริ่มต้นเดียวกัน หากเคยบันทึกค่าในเบราว์เซอร์แล้ว ให้ทดสอบค่าเริ่มต้นในเบราว์เซอร์หรือโปรไฟล์ใหม่
- หน้าเว็บรองรับ ABI ที่มี `deposit() payable`, `withdraw(uint256) nonpayable` และ `checkBalance() view returns (uint256)` หรือ `CheckBlance() view returns (uint256)` ยอดที่อ่านและอาร์กิวเมนต์ของการถอนใช้หน่วย wei หากสัญญาต้นฉบับต่างจากนี้ ให้แก้การเรียกใน `app.js` ให้ตรงกับ ABI

## 3. เผยแพร่และส่งงาน

1. Push โปรเจกต์เข้า GitHub repository ของนักศึกษา
2. ไปที่ **Settings → Pages** เลือก **Deploy from a branch** แล้วเลือก branch ที่ push ไว้ (เช่น `main`) และโฟลเดอร์ **/ (root)** แล้วกด **Save**
3. เปิด URL ที่ GitHub Pages แสดงด้วยเบราว์เซอร์ที่มี MetaMask ทดสอบกับสัญญาที่ deploy ใหม่โดยฝาก **0.01 ETH** เช็คยอด จากนั้นถอน **0.004 ETH** และเช็คว่ายอดเหลือ **0.006 ETH** ค่าธรรมเนียมถูกหักจากยอดกระเป๋า
4. ตรวจว่ารหัสนักศึกษาและชื่อ–สกุลแสดงบนเว็บ แล้วส่ง URL ของ GitHub Pages ใน dlearning
