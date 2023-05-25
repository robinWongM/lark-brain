import 'dotenv/config';
import * as lark from '@larksuiteoapi/node-sdk';

export const larkClient = new lark.Client({
  appId: process.env.APP_ID!,
  appSecret: process.env.APP_SECRET!,
})

export const dispatcher = new lark.EventDispatcher({
  verificationToken: process.env.VERIFICATION_TOKEN!,
  encryptKey: process.env.ENCRYPT_KEY!,
});

/**
 * Represents the type of a block in a document.
 */
enum DocxBlockType {
  /** 页面 Block */
  Page = 1,
  /** 文本 Block */
  Text = 2,
  /** 标题 1 Block */
  Title1 = 3,
  /** 标题 2 Block */
  Title2 = 4,
  /** 标题 3 Block */
  Title3 = 5,
  /** 标题 4 Block */
  Title4 = 6,
  /** 标题 5 Block */
  Title5 = 7,
  /** 标题 6 Block */
  Title6 = 8,
  /** 标题 7 Block */
  Title7 = 9,
  /** 标题 8 Block */
  Title8 = 10,
  /** 标题 9 Block */
  Title9 = 11,
  /** 无序列表 Block */
  UnorderedList = 12,
  /** 有序列表 Block */
  OrderedList = 13,
  /** 代码块 Block */
  CodeBlock = 14,
  /** 引用 Block */
  Quote = 15,
  /** 待办事项 Block */
  Todo = 17,
  /** 多维表格 Block */
  MultidimensionalTable = 18,
  /** 高亮块 Block */
  Highlight = 19,
  /** 会话卡片 Block */
  SessionCard = 20,
  /** 流程图 & UML Block */
  FlowchartAndUML = 21,
  /** 分割线 Block */
  Divider = 22,
  /** 文件 Block */
  File = 23,
  /** 分栏 Block */
  Column = 24,
  /** 分栏列 Block */
  ColumnItem = 25,
  /** 内嵌 Block Block */
  NestedBlock = 26,
  /** 图片 Block */
  Image = 27,
  /** 开放平台小组件 Block */
  OpenPlatformWidget = 28,
  /** 思维笔记 Block */
  MindNote = 29,
  /** 电子表格 Block */
  Spreadsheet = 30,
  /** 表格 Block */
  Table = 31,
  /** 表格单元格 Block */
  TableCell = 32,
  /** 视图 Block */
  View = 33,
  /** 引用容器 Block */
  ReferenceContainer = 34,
  /** 任务 Block */
  Task = 35,
  /** 未支持 Block */
  Unsupported = 999,
}