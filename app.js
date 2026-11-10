import { BrowserProvider, Contract, FetchRequest, Interface, JsonRpcProvider, formatEther, getAddress, parseEther } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.5/ethers.min.js";
import { defaults } from "./config.js";

const field = (id) => document.getElementById(id);
const explorer = "https://sepolia.etherscan.io";
const sepolia = "0xaa36a7";
const storageKey = "sepolia-bank-v1";
const wallet = window.ethereum?.providers?.find((provider) => provider.isMetaMask)
  ?? (window.ethereum?.isMetaMask ? window.ethereum : null);
let settings = { ...defaults };
let connection;
let revision = 0;
let busy = false;
let walletChanged = false;

try {
  settings = { ...settings, ...JSON.parse(localStorage.getItem(storageKey)) };
} catch {
  // The page can still use config.js if browser storage is unavailable.
}

function status(message, error = false) {
  field("status").textContent = message;
  field("status").classList.toggle("error", error);
}

function showSettings() {
  for (const key of ["address", "studentId", "studentName", "infuraApiKey"]) {
    field(key).value = settings[key];
  }
  field("abi").value = settings.abi.length ? JSON.stringify(settings.abi, null, 2) : "";
  field("student").textContent = `รหัสนักศึกษา ${settings.studentId || "—"} · ชื่อ–สกุล ${settings.studentName || "—"}`;
  const link = field("contractLink");
  link.hidden = !/^0x[0-9a-f]{40}$/i.test(settings.address);
  if (!link.hidden) link.href = `${explorer}/address/${settings.address}`;
}

function contractDetails(config) {
  const address = getAddress(config.address);
  if (!Array.isArray(config.abi) || !config.abi.length) {
    throw new Error("กรุณาวาง ABI แบบ JSON array จาก Remix");
  }
  const abi = new Interface(config.abi);
  const deposit = abi.getFunction("deposit()");
  const withdraw = abi.getFunction("withdraw(uint256)");
  const balance = abi.getFunction("checkBalance()") ?? abi.getFunction("CheckBlance()");
  if (deposit?.stateMutability !== "payable" ||
      withdraw?.stateMutability !== "nonpayable" ||
      !["view", "pure"].includes(balance?.stateMutability) ||
      balance.outputs.length !== 1 || balance.outputs[0].type !== "uint256") {
    throw new Error("ABI ต้องมี deposit(), withdraw(uint256) และ checkBalance() หรือ CheckBlance()");
  }
  return { address, abi, balanceMethod: balance.format("sighash") };
}

function updateButtons() {
  for (const id of ["deposit", "withdraw", "refresh"]) {
    field(id).disabled = busy || !connection;
  }
  field("connect").disabled = busy;
  field("save").disabled = busy;
}

function clearConnection() {
  revision += 1;
  connection = undefined;
  field("balance").textContent = "—";
  field("wallet").textContent = "ยังไม่ได้เชื่อมต่อกระเป๋า";
  updateButtons();
}

async function syncWallet() {
  walletChanged = false;
  clearConnection();
  const current = revision;
  if (!wallet) throw new Error("กรุณาเปิดเว็บในเบราว์เซอร์ที่ติดตั้ง MetaMask");

  const [chain, accounts] = await Promise.all([
    wallet.request({ method: "eth_chainId" }),
    wallet.request({ method: "eth_accounts" }),
  ]);
  if (current !== revision) return;
  if (!accounts.length) {
    status("เชื่อมต่อ MetaMask เพื่อเริ่มใช้งาน");
    return;
  }
  if (chain !== sepolia) {
    status("กรุณาเปลี่ยนเครือข่าย MetaMask เป็น Sepolia", true);
    return;
  }
  field("wallet").textContent = accounts[0];
  if (!settings.address || !settings.abi.length) {
    field("settings").open = true;
    status("ใส่ Contract address และ ABI จาก Remix แล้วบันทึกการตั้งค่า");
    return;
  }

  const { address, abi, balanceMethod } = contractDetails(settings);
  if (!settings.infuraApiKey) {
    field("settings").open = true;
    status("ใส่ Infura API Key สำหรับ Sepolia แล้วบันทึกการตั้งค่า");
    return;
  }

  const request = new FetchRequest(`https://sepolia.infura.io/v3/${settings.infuraApiKey}`);
  request.timeout = 12000;
  const infura = new JsonRpcProvider(request, 11155111, { staticNetwork: true });
  let code;
  let balance;
  try {
    code = await infura.getCode(address);
    if (code !== "0x" && current === revision) {
      const reader = new Contract(address, abi, infura);
      // The contract uses msg.sender to select the balance.
      balance = await reader[balanceMethod]({ from: accounts[0] });
    }
  } catch (error) {
    const message = error.code === "CALL_EXCEPTION" || error.code === "BAD_DATA"
      ? "อ่านยอดจากสัญญาไม่ได้ กรุณาตรวจ Contract address และ ABI"
      : "เชื่อมต่อ Infura ไม่สำเร็จ กรุณาตรวจ API Key และสิทธิ์เข้าถึง Sepolia";
    throw new Error(message);
  } finally {
    infura.destroy();
  }
  if (current !== revision) return;
  if (code === "0x") {
    throw new Error("ไม่พบ Smart Contract ที่ address นี้บน Sepolia");
  }

  const signer = await new BrowserProvider(wallet).getSigner(accounts[0]);
  if (current !== revision) return;
  const contract = new Contract(address, abi, signer);
  connection = { account: accounts[0], contract };
  field("balance").textContent = formatEther(balance);
  status("เชื่อมต่อ Sepolia ผ่าน Infura แล้ว · ฝากและถอนด้วย MetaMask");
  updateButtons();
}

function report(error) {
  const rejected = error.code === 4001 || error.code === "ACTION_REJECTED";
  status(rejected ? "ยกเลิกรายการใน MetaMask" :
    (error.revert?.name === "InsufficientBalance" ? "ยอดเงินในธนาคารไม่พอสำหรับการถอน" :
      error.shortMessage || error.message), true);
}

async function run(action) {
  if (busy) return;
  busy = true;
  updateButtons();
  try {
    await action();
  } catch (error) {
    report(error);
  } finally {
    busy = false;
    updateButtons();
    if (walletChanged) {
      walletChanged = false;
      void run(syncWallet);
    }
  }
}

field("connect").addEventListener("click", () => run(async () => {
  if (!wallet) throw new Error("กรุณาเปิดเว็บในเบราว์เซอร์ที่ติดตั้ง MetaMask");
  await wallet.request({ method: "eth_requestAccounts" });
  if (await wallet.request({ method: "eth_chainId" }) !== sepolia) {
    try {
      await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: sepolia }] });
    } catch (error) {
      if (error.code !== 4902) throw error;
      throw new Error("เปิด Show test networks ใน MetaMask แล้วเลือก Sepolia ก่อนเชื่อมต่ออีกครั้ง");
    }
  }
  await syncWallet();
}));

field("configuration").addEventListener("submit", (event) => {
  event.preventDefault();
  run(async () => {
    let abi;
    try {
      abi = JSON.parse(field("abi").value);
    } catch {
      throw new Error("ABI ต้องเป็น JSON ที่คัดลอกจาก Remix");
    }
    const next = {
      address: field("address").value.trim(),
      abi,
      infuraApiKey: field("infuraApiKey").value.trim(),
      studentId: field("studentId").value.trim(),
      studentName: field("studentName").value.trim(),
    };
    if (!/^[a-z0-9]+$/i.test(next.infuraApiKey)) {
      throw new Error("กรอก Infura API Key สำหรับ Sepolia");
    }
    next.address = contractDetails(next).address;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      throw new Error("เบราว์เซอร์ไม่อนุญาตให้บันทึกการตั้งค่า ใช้ config.js เพื่อกำหนดค่าเริ่มต้น");
    }
    settings = next;
    showSettings();
    await syncWallet();
  });
});

field("refresh").addEventListener("click", () => run(syncWallet));

field("transfer").addEventListener("submit", (event) => {
  event.preventDefault();
  run(async () => {
    const active = connection;
    if (!active) throw new Error("เชื่อมต่อ Smart Contract ก่อนทำรายการ");
    const method = event.submitter?.value;
    if (method !== "deposit" && method !== "withdraw") return;
    const input = field("amount").value.trim();
    if (!/^\d+(\.\d{1,18})?$/.test(input)) {
      throw new Error("ใส่จำนวน ETH เป็นตัวเลข ทศนิยมได้สูงสุด 18 ตำแหน่ง");
    }
    const amount = parseEther(input);
    if (amount <= 0n) throw new Error("จำนวน ETH ต้องมากกว่า 0");

    const [chain, accounts] = await Promise.all([
      wallet.request({ method: "eth_chainId" }),
      wallet.request({ method: "eth_accounts" }),
    ]);
    if (active !== connection || chain !== sepolia ||
        accounts[0]?.toLowerCase() !== active.account.toLowerCase()) {
      throw new Error("บัญชีหรือเครือข่ายเปลี่ยน กรุณาเชื่อมต่อใหม่");
    }
    const link = field("tx");
    link.hidden = true;
    status("ตรวจสอบรายละเอียดและยืนยันใน MetaMask");
    const tx = method === "deposit"
      ? await active.contract.deposit({ value: amount })
      : await active.contract.withdraw(amount);
    link.href = `${explorer}/tx/${tx.hash}`;
    link.hidden = false;
    status("ส่งธุรกรรมแล้ว กำลังรอการยืนยันบน Sepolia");
    await tx.wait();
    field("amount").value = "";
    if (active === connection) {
      try {
        await syncWallet();
      } catch {
        status("ธุรกรรมยืนยันแล้ว กดเชื่อมต่อใหม่เพื่ออ่านยอดล่าสุด");
        return;
      }
    }
    status("ธุรกรรมยืนยันแล้วบน Sepolia");
  });
});

for (const event of ["accountsChanged", "chainChanged", "disconnect"]) {
  wallet?.on(event, () => {
    if (busy) {
      walletChanged = true;
      clearConnection();
    } else {
      run(syncWallet);
    }
  });
}

showSettings();
field("settings").open = !settings.address || !settings.abi.length || !settings.infuraApiKey;
if (wallet) run(syncWallet);
else status("ติดตั้ง MetaMask ในเบราว์เซอร์เพื่อใช้งานบน Sepolia");
