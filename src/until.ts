/**
 * 骰子计算函数
 * @param n 骰子数量
 * @param x 骰子面数
 * @param k 结果乘数 (默认1)
 * @param p 修正值 (默认0)
 * @param c 常数加值 (默认0)
 * @returns 计算结果: (骰子总和 + 修正值) * 乘数 + 常数
 */
export function D(n: number, x: number, k = 1, p = 0, c = 0) {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let randomNumber = Math.floor(Math.random() * x) + 1;
    sum += randomNumber;
  }
  sum += p;
  return sum * k + c;
}

export function SetNameCard(ctx:seal.MsgContext){
  const nameCard = seal.format(ctx,"{$t玩家_RAW} 情绪:{情绪} 能量:{能量}/6")
  seal.setPlayerGroupCard(ctx,nameCard);
}

/**
 * 处理sl参数，有符号被视为修改值，无符号被视为共情面
 * @param params 传入的参数
 * @returns [modify, empathy] modify为修正值，empathy为共情面
 */
export function dealSlParams(params: string[]): [number[], number[]] {
  const modify:number[] = [];
  const empathy:number[] = [];
  for ( let k:number=0;k<params.length;k++) {
    if (isNaN(Number(params[k]))){
      continue;
    }
    if (params[k].startsWith("-")||params[k].startsWith("+")) {
      modify.push(Number(params[k]));
      continue;
    }
    empathy.push(Number(params[k]));
  }
  return [modify, empathy];
}

/**
 * SlDice类
 * @description 用于处理、管理和使用骰子
 */
export class SlDice {
  /**
   * 骰子面数
   */
  diceCount: number = 6;
  /**
   * 骰子明细
   * @description 骰子的详细信息，包括描述、是否为共情面、状态等
   * @type {description: string, isEmpathy: boolean, status: number,statusDesc: string}[]
   * @property {boolean} isEmpathy 是否为共情面
   * @property {string} description 特长描述，仅在isEmpathy为true时有效
   * @property {number} status 状态,0为正常，1为伤痕，2为创伤
   * @property {string} statusDesc 创伤描述,仅在status为2时有效
   */
  table: { description: string, isEmpathy: boolean, status: number,statusDesc: string }[]
  /**
   * 构造函数
   * @param diceCount 骰子面数，默认为6
   */
  constructor(diceCount:number=6) {
    this.diceCount = diceCount;
    this.table = Array.from({length: diceCount}, () => ({
        description: "",
        isEmpathy: false,
        status: 0,
        statusDesc: ""
      }
    ));
  }

  /**
   * 从 JSON 字符串创建 SlDiceTable 实例
   * @param jsonString JSON 字符串
   * @returns SlDiceTable 实例
   */
  static fromJSON(jsonString: string): SlDice {
    const raw = JSON.parse(jsonString);
    const table = new SlDice();
    // 复制 diceCount 属性（带默认值保护）
    if (raw.diceCount && typeof raw.diceCount === "number") {
      table.diceCount = raw.diceCount;
    }
    // 复制 table 属性（带默认值保护）
    if (raw.table && Array.isArray(raw.table)) {
      table.table = raw.table.map((item: any) => ({
        description: item.description || "",
        isEmpathy: Boolean(item.isEmpathy),
        status: Number(item.status) || 0,
        statusDesc: item.statusDesc || ""
      }));
    }

    return table;
  }
  /**
   * 掷骰子
   * @returns [index, description] index为骰子出目，description为描述
   */
  roll(empathy:number[] = null, modify:number = 0): [number, { description: string, isEmpathy: boolean, status: number, },result:number,resultText:string] {
    const index:number = D(1, this.diceCount, 1);
    if (empathy===null) {
      return [index, this.table[index-1],0,"0"];
    }
    let result:number = 0;
    let resultText:string = "";
    // 检查出目是否是共情面
    if (this.table[index-1].isEmpathy&&this.table[index-1].status===0) {
      result += 1;
      resultText += "1";
    }else{
      resultText += "0";
    }
    // 特长是否触发
    for (const item of empathy) {
      if (empathy[item] > this.diceCount || empathy[item]<=0) {
        continue;
      }
      if (empathy[item]  === index) {
        result += 1;
        resultText += "+2";
        continue;
      }
      resultText += "+1";
    }
    result += modify;
    if (modify>0) {
      resultText += `+${modify}=${result}`;
    }else{
      resultText += `=${result}`;
    }
    return [index, this.table[index-1],result,resultText];
  }

  /**
   * 编辑骰子
   * @param index 骰子序号
   * @param description 描述
   * @param isEmpathy 是否为共情面
   */
  edit(index:number, description:string, isEmpathy:boolean): void {
    if (index < 1 || index > this.diceCount) {
      return
    }
    this.table[index-1].description = description;
    this.table[index-1].isEmpathy = isEmpathy;
  }

  /**
   * 受伤
   * @param index 骰子序号
   * @param statusDesc 创伤描述
   */
  hurt(index:number, statusDesc:string=""): void {
    this.table[index-1].status = 2;
    this.table[index-1].statusDesc = statusDesc;
  }

  /**
   * 治愈
   * @param indexes 目标面数
   */
  heal(indexes:number[]): void {
    for (const index of indexes) {
      if (index > this.diceCount || index < 1) {
        continue;
      }
      this.table[index-1].status -=1;
      if (this.table[index-1].status<=0){
        this.table[index-1].status = 0;
        this.table[index-1].statusDesc = "";
      }
    }
  }

  /**
   * 复制共情面
   * @param targetInfo 目标骰子
   * @param targetIndex 目标骰子序号
   * @param selfIndex 自身骰子序号
   */
  copy(targetInfo: SlDice, targetIndex: number, selfIndex: number): void {
    if (targetIndex > targetInfo.diceCount || targetIndex<1 || selfIndex > this.diceCount || selfIndex<1 ||targetInfo.table[targetIndex].isEmpathy===false) {
      return;
    }
    this.table[selfIndex-1].isEmpathy = true;
    this.table[selfIndex-1].description = targetInfo.table[targetIndex-1].description;
  }

  getEffect(result:number): string{
    let effect:string = "";
    if (this.table[result-1].status===1) {
      effect = "伤痕";
      return effect;
    }
    if (this.table[result-1].status===2) {
      effect = "创伤:"+this.table[result-1].statusDesc;
      return effect;
    }
    if (this.table[result-1].isEmpathy) {
      effect = "共情："+this.table[result-1].description;
      return effect;
    }
    return "平凡";
  }

  toString(): string {
    let fmtString = "";
    for (let i = 0; i < this.diceCount; i++) {
      if (this.table[i].status === 0 && !this.table[i].isEmpathy) {
        continue;
      }
      fmtString += `${i+1}:`;
      if (this.table[i].isEmpathy) {
        fmtString += `${this.table[i].description}   `;
      }
      if (this.table[i].status === 1) {
        fmtString += `伤痕`;
      }
      if (this.table[i].status === 2) {
        fmtString += `创伤:${this.table[i].statusDesc}`;
      }
      fmtString += "\n";
    }
    return fmtString;
  }
}
