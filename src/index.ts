import {EmotionFmt, HelpDoc} from "./TR";
import {dealSlParams, SlDice} from "./until";

function main() {
  // 注册规则
  const template = {
    "name": "starlight",
    "fullName": "繁星物语",
    "authors": ["Sheyiyuan"],
    "version": "2.0.0",
    "updatedTime": "20250406",
    "templateVer": "1.0",

    // .set 相关内容，使用.set sl开启，切4面骰，并提示enableTip中的内容
    "setConfig": {
      "diceSides": 6,
      "enableTip": "已切换至繁星物语Starlight扩展",
      "keys": ["sl", "starlight", "繁星物语"],
      "relatedExt": ["starlight"]
    },

    // sn相关内容，可使用.sn sl 自动设置名片
    "nameTemplate": {
      "sl": {
        "template": "{$t玩家_RAW} 情绪:{情绪} 能量:{能量}/6",
        "helpText": "自动设置Starlight格式的角色名片"
      }
    },

    "attrConfig": {
      "sortBy": "name",
      // st show 隐藏内容
      "ignores": ["*dice"],
    },

    // 默认值
    "defaults": {
      "能量": 0,
    },
    // 同义词，存卡和设置属性时，所有右边的词会被转换为左边的词，不分大小写
    "alias": {
      "情绪": ["emotion", "emotions", "emotions", "emotion"],
    },
  }

  try {
    seal.gameSystem.newTemplate(JSON.stringify(template))
  } catch (e) {
    // 如果扩展已存在，或加载失败，则忽略并打印错误信息
    console.log(e)
  }

  // 注册扩展
  let ext = seal.ext.find('starlight');
  if (!ext) {
    ext = seal.ext.new('starlight', 'Sheyiyuan', '2.0.0');
    seal.ext.register(ext);
  }

  /**
   * 帮助文档
   */
  const cmdDoc = seal.ext.newCmdItemInfo();
  cmdDoc.name = 'starlight';
  cmdDoc.help = '显示扩展使用手册';
  cmdDoc.solve = (ctx, msg, _cmdArgs) => {
    seal.replyToSender(ctx, msg, HelpDoc);
    return seal.ext.newCmdExecuteResult(true);
  }

  /**
   * 检定
   */
  const cmdSl = seal.ext.newCmdItemInfo();
  cmdSl.name = 'sl';
  cmdSl.help = 'sl的基本检定 sl [共情面] ... [加值]';
  cmdSl.allowDelegate = true;
  cmdSl.solve = (ctx, msg, cmdArgs) => {
    let mctx = seal.getCtxProxyFirst(ctx,cmdArgs)
    if (mctx != null){
      ctx = mctx;
    }
    let val = cmdArgs.getArgN(1);
    switch (val) {
      case 'help': {
        const ret = seal.ext.newCmdExecuteResult(true);
        ret.showHelp = true;
        return ret;
      }
      default: {
        const [modify, empathy]:[number[],number[]] = dealSlParams(cmdArgs.args);
        if (modify.length === 0){
          modify.push(0);
        }
        const modifyValue:number = modify[0];
        let diceJson:string
        try {
          diceJson = seal.vars.strGet(ctx, "*dice")[0];
        }
        catch(e) {
          seal.replyToSender(ctx,msg,`请先使用.st录入角色骰子。`)
          return seal.ext.newCmdExecuteResult(true);
        }
        const dice = SlDice.fromJSON(diceJson);
        const result = dice.roll(empathy,modifyValue);
        let replyText = `<${ctx.player.name}>的检定出目为:\n${result[0]} ${dice.getEffect(result[0])}\n最终结果为：${result[3]}`;
        // 结算能量
        let energy = seal.vars.intGet(ctx, "能量")[0];
        const emotion = seal.vars.strGet(ctx, "情绪")[0];
        let energyDelta = 0;
        if (emotion === "愉悦") {
          energyDelta = 0;
        } else if (emotion === "痛苦") {
          energyDelta = 2;
        }else{
          energyDelta = 1;
        }
        energy += energyDelta;
        if (energy > 6) {
          energy = 6;
        }
        replyText += `\n本次行动获得${energyDelta}点能量，当前能量值为：${energy}/6`;
        seal.vars.intSet(ctx, "能量", energy);
        seal.replyToSender(ctx,msg,replyText);
        return seal.ext.newCmdExecuteResult(true);
      }
    }
  }

  /**
   * 录入角色骰子
   */
  const cmdSt = seal.ext.newCmdItemInfo();
  cmdSt.name = 'st';
  cmdSt.help = '录入角色骰子';
  cmdSt.solve = (ctx, msg, cmdArgs) => {
    let val = cmdArgs.getArgN(1);
    switch (val) {
      case 'help': {
        const ret = seal.ext.newCmdExecuteResult(true);
        ret.showHelp = true;
        return ret;
      }
      case 'show': {
        let energy = seal.vars.intGet(ctx, "能量")[0];
        const diceJson: string = seal.vars.strGet(ctx, "*dice")[0];
        const dice = SlDice.fromJSON(diceJson);
        seal.replyToSender(ctx,msg,`<${ctx.player.name}>的角色信息：\n情绪:${seal.vars.strGet(ctx,"情绪")[0]}  能量:${energy}/6\n${dice.toString()}`);
        return seal.ext.newCmdExecuteResult(true);
      }
      default: {
        seal.vars.strSet(ctx, "情绪", "平静");
        const dice: SlDice = new SlDice(6);
        const args  = cmdArgs.args;
        for (let i = 0; i < args.length; i += 2) {
          const indexStr: string = args[i];
          if (isNaN(Number(indexStr))) {
            continue;
          }
          const index = Number(indexStr);
          if (index < 1 || index > 6) {
            continue;
          }
          const description: string = args[i+1];
          dice.edit(index, description, true);
          seal.vars.strSet(ctx, indexStr, description);
        }
        seal.vars.strSet(ctx, "*dice", JSON.stringify(dice));
        seal.replyToSender(ctx, msg, `已录入<${ctx.player.name}>的角色骰子：\n${dice.toString()}`);
        return seal.ext.newCmdExecuteResult(true);
      }
    }
  }

  /**
   * 设置角色情绪
   */
  const cmdEmote = seal.ext.newCmdItemInfo();
  cmdEmote.name = 'emo';
  cmdEmote.help = '设置角色情绪';
  cmdEmote.allowDelegate = true;
  cmdEmote.solve = (ctx, msg, cmdArgs) => {
    let mctx = seal.getCtxProxyFirst(ctx,cmdArgs)
    if (mctx != null){
      ctx = mctx;
    }
    let val = cmdArgs.getArgN(1);
    switch (val) {
      case 'help': {
        const ret = seal.ext.newCmdExecuteResult(true);
        ret.showHelp = true;
        return ret;
      }
      default: {
        let emotion = val;
        emotion = EmotionFmt[emotion.toLowerCase()];
        seal.vars.strSet(ctx, "情绪", emotion);
        seal.replyToSender(ctx,msg,`已设置<${ctx.player.name}>的情绪为：${emotion}`);
        return seal.ext.newCmdExecuteResult(true);
      }
    }
  }

  /**
   * 设置角色能量
   */
  const cmdEn = seal.ext.newCmdItemInfo();
  cmdEn.name = 'en';
  cmdEn.help = '设置角色能量';
  cmdEn.allowDelegate = true;
  cmdEn.solve = (ctx, msg, cmdArgs) => {
    let mctx = seal.getCtxProxyFirst(ctx,cmdArgs)
    if (mctx != null){
      ctx = mctx;
    }
    let val = cmdArgs.getArgN(1);
    switch (val) {
      case 'help': {
        const ret = seal.ext.newCmdExecuteResult(true);
        ret.showHelp = true;
        return ret;
      }
      default: {
        let energy = Number(val);
        if (isNaN(energy) || energy < 0 || energy > 6){
          seal.replyToSender(ctx,msg,`能量值必须为0-6之间的整数。`);
          return seal.ext.newCmdExecuteResult(true);
        }
        seal.vars.intSet(ctx, "能量", energy);
        seal.replyToSender(ctx,msg,`已设置<${ctx.player.name}>的能量值为：${energy}/6`);
        return seal.ext.newCmdExecuteResult(true);
      }
    }
  }

  /**
   * 设置创伤
   */
  const cmdHurt = seal.ext.newCmdItemInfo();
  cmdHurt.name = 'hurt';
  cmdHurt.help = '设置角色创伤';
  cmdHurt.allowDelegate = true;
  cmdHurt.solve = (ctx, msg, cmdArgs) => {
    let mctx = seal.getCtxProxyFirst(ctx,cmdArgs)
    if (mctx != null){
      ctx = mctx;
    }
    let val = cmdArgs.getArgN(1);
    switch (val) {
      case 'help': {
        const ret = seal.ext.newCmdExecuteResult(true);
        ret.showHelp = true;
        return ret;
      }
      default: {
        const index:number = Number(val);
        if (isNaN(index) || index < 1 || index > 6){
          seal.replyToSender(ctx,msg,`创伤所在位置必须为1-6之间的整数。`);
          return seal.ext.newCmdExecuteResult(true);
        }
        const description:string = cmdArgs.getArgN(2);

        const diceJson: string = seal.vars.strGet(ctx, "*dice")[0];
        const dice = SlDice.fromJSON(diceJson);
        if (dice.table[index].status !==0){
          seal.replyToSender(ctx,msg,`该位置已经有创伤，无法再次设置创伤。`);
          return seal.ext.newCmdExecuteResult(true);
        }
        dice.hurt(index,description);
        seal.vars.strSet(ctx, "*dice", JSON.stringify(dice));
        seal.replyToSender(ctx,msg,`已设置<${ctx.player.name}>在第${index}个位置的创伤为：${description}`);
        return seal.ext.newCmdExecuteResult(true);
      }
    }
  }

  /**
   * 治疗创伤
   */
  const cmdHeal = seal.ext.newCmdItemInfo();
  cmdHeal.name = 'heal';
  cmdHeal.help = '治疗角色创伤';
  cmdHeal.allowDelegate = true;
  cmdHeal.solve = (ctx, msg, cmdArgs) => {
    let mctx = seal.getCtxProxyFirst(ctx,cmdArgs)
    if (mctx!= null){
      ctx = mctx;
    }
    let val = cmdArgs.getArgN(1);
    switch (val) {
      case 'help': {
        const ret = seal.ext.newCmdExecuteResult(true);
        ret.showHelp = true;
        return ret;
      }
      default: {
        let indexes:number[] = [];
        for (let i = 0; i <= cmdArgs.args.length; i++) {
          const index:number = Number(cmdArgs.args[i]);
          if (isNaN(index) || index < 0 || index > 6){
            continue;
          }
          indexes.push(index);
        }
        const diceJson: string = seal.vars.strGet(ctx, "*dice")[0];
        const dice = SlDice.fromJSON(diceJson);
        dice.heal(indexes);
        seal.vars.strSet(ctx, "*dice", JSON.stringify(dice));
        seal.replyToSender(ctx,msg,`已治疗<${ctx.player.name}>指定面的所有创伤。`);
        return seal.ext.newCmdExecuteResult(true);
      }
    }
  }
  /**
   * 复制共情面
   */
  const cmdCopy = seal.ext.newCmdItemInfo();
  cmdCopy.name = 'copy';
  cmdCopy.help = '复制共情面';
  cmdCopy.allowDelegate = true;
  cmdCopy.solve = (ctx, msg, cmdArgs) => {
    let mctx = seal.getCtxProxyFirst(ctx,cmdArgs)
    let val = cmdArgs.getArgN(1);
    switch (val) {
      case 'help': {
        const ret = seal.ext.newCmdExecuteResult(true);
        ret.showHelp = true;
        return ret;
      }
      default: {
        if (mctx === null) {
          seal.replyToSender(ctx, msg, `请指定要复制的目标角色。`);
          return seal.ext.newCmdExecuteResult(true);
        }
        const targetDiceJson = seal.vars.strGet(mctx, "*dice")[0];
        const targetDice = SlDice.fromJSON(targetDiceJson);
        const diceJson: string = seal.vars.strGet(ctx, "*dice")[0];
        const dice = SlDice.fromJSON(diceJson);
        const target = Number(cmdArgs.getArgN(2));
        const self = Number(cmdArgs.getArgN(3));
        if (isNaN(target) || target < 0 || target > 6||isNaN(self) || self < 0 || self > 6){
          seal.replyToSender(ctx,msg,`目标位置必须为0-6之间的整数。`);
          return seal.ext.newCmdExecuteResult(true);
        }
        dice.copy(targetDice, target, self);
        seal.vars.strSet(ctx, "*dice", JSON.stringify(dice));
        seal.replyToSender(ctx,msg,`已复制<${mctx.player.name}>的第${target}个位置的共情面到<${ctx.player.name}>的第${self}个位置。`);
        return seal.ext.newCmdExecuteResult(true);
      }
    }
  }

  // 注册命令
  ext.cmdMap['sl'] = cmdSl;
  ext.cmdMap['starlight'] = cmdDoc;
  ext.cmdMap['fxwy'] = cmdDoc;
  ext.cmdMap['fanxingwuyu'] = cmdDoc;
  ext.cmdMap['繁星物语'] = cmdDoc;
  ext.cmdMap['st'] = cmdSt;
  ext.cmdMap['emo'] = cmdEmote;
  ext.cmdMap['en'] = cmdEn;
  ext.cmdMap['hurt'] = cmdHurt;
  ext.cmdMap['heal'] = cmdHeal;
  ext.cmdMap['copy'] = cmdCopy;
}

main();
