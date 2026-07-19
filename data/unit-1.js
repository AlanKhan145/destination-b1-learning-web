// Dữ liệu bài học Unit 1 - Grammar: Present time
// Chỉ chứa dữ liệu thuần, không chứa HTML. Renderer (js/lesson-renderer.js) chịu trách nhiệm hiển thị.

const lessonData = {
  id: "unit-1",
  unitNumber: 1,
  category: "Grammar",
  title: "Present time",
  description: "Các thì hiện tại trong tiếng Anh: present simple, present continuous, present perfect simple, present perfect continuous và stative verbs.",

  topics: [
    {
      id: "present-simple",
      number: 1,
      title: "Present simple",
      status: "available",
      description: "Diễn tả thói quen, sự thật hiển nhiên và những tình huống lâu dài, ổn định trong hiện tại.",
      formula: null,
      formulaNote: null,
      forms: {
        columns: ["Dạng", "I / you / we / they", "He / she / it"],
        rows: [
          ["Statement", "I/You/We/They travel ...", "He/She/It travels ..."],
          ["Negative", "I/You/We/They don't travel ...", "He/She/It doesn't travel ..."],
          ["Question", "Do I/you/we/they travel ...?", "Does he/she/it travel ...?"]
        ]
      },
      uses: [
        {
          usage: "Current habits – Thói quen hiện tại",
          example: "Toby walks to work."
        },
        {
          usage: "To talk about how often things happen – Nói về tần suất xảy ra của sự việc",
          example: "Angela doesn't visit us very often."
        },
        {
          usage: "Permanent situations – Những tình huống lâu dài, ổn định",
          example: "Carlo works in a travel agent's."
        },
        {
          usage: "States – Trạng thái",
          example: "Do you have an up-to-date passport?"
        },
        {
          usage: "General truths and facts – Sự thật và chân lý chung",
          example: "Poland is in the European Union."
        }
      ],
      notes: [
        {
          title: "Watch out!",
          paragraphs: [
            "Chúng ta cũng có thể sử dụng do/does trong câu khẳng định ở thì hiện tại đơn để nhấn mạnh."
          ],
          examples: [
            { en: "“You don't like going by bus, do you?”", highlight: [] },
            { en: "“Actually, I do like going by bus for short distances.”", highlight: ["do"] },
            { en: "The bus isn't quicker than the train, but it does stop right outside the factory.", highlight: ["does"] }
          ]
        }
      ]
    },

    {
      id: "present-continuous",
      number: 2,
      title: "Present continuous",
      status: "available",
      description: "Diễn tả hành động đang xảy ra ngay lúc nói, tình huống tạm thời hoặc đang thay đổi.",
      formula: null,
      formulaNote: null,
      forms: {
        columns: ["Dạng", "Cấu trúc"],
        rows: [
          ["Statement", ["I am driving ...", "You, We, They are driving ...", "He, She, It is driving ..."]],
          ["Negative", ["I'm not driving ...", "You, We, They aren't driving ...", "He, She, It isn't driving ..."]],
          ["Question", ["Am I driving ...?", "Are you, we, they driving ...?", "Is he, she, it driving ...?"]]
        ]
      },
      uses: [
        {
          usage: "Actions happening now – Hành động đang xảy ra ngay lúc nói",
          example: "Mike is driving to work at the moment."
        },
        {
          usage: "Temporary series of actions – Một chuỗi hành động mang tính tạm thời",
          example: "Taxi drivers aren't stopping at the train station because of the roadworks."
        },
        {
          usage: "Temporary situations – Tình huống tạm thời",
          example: "Are they staying in a hotel near the Olympic stadium?"
        },
        {
          usage: "Changing and developing situations – Tình huống đang thay đổi hoặc phát triển",
          example: "Holidays abroad are becoming increasingly popular."
        },
        {
          usage: "Annoying habits, usually with always – Thói quen gây khó chịu, thường dùng với “always”",
          example: "Dad is always cleaning the car when I want to use it!",
          highlight: ["always"]
        }
      ],
      notes: []
    },

    {
      id: "present-perfect-simple",
      number: 3,
      title: "Present perfect simple",
      status: "available",
      description: "Diễn tả hành động hoặc trạng thái bắt đầu trong quá khứ và có liên hệ với hiện tại.",
      formula: "have/has + past participle",
      formulaNote: "have/has + quá khứ phân từ",
      forms: {
        columns: ["Dạng", "I / you / we / they", "He / she / it"],
        rows: [
          ["Statement", "I/You/We/They have flown ...", "He/She/It has flown ..."],
          ["Negative", "I/You/We/They haven't flown ...", "He/She/It hasn't flown ..."],
          ["Question", "Have I/you/we/they flown ...?", "Has he/she/it flown ...?"]
        ]
      },
      uses: [
        {
          usage: "Situations and states that started in the past and are still true – Tình huống hoặc trạng thái bắt đầu trong quá khứ và vẫn còn đúng ở hiện tại",
          example: "She's had her motorbike for over six years."
        },
        {
          usage: "A series of actions continuing up to now – Một chuỗi hành động tiếp diễn cho đến hiện tại",
          example: "We've travelled by taxi, bus, plane and train – all in the last twenty-four hours!"
        },
        {
          usage: "Completed actions at a time in the past which is not mentioned – Hành động đã hoàn thành nhưng không đề cập thời điểm cụ thể",
          example: "Have you ever flown in a helicopter?"
        },
        {
          usage: "Completed actions where the important thing is the present result – Hành động đã hoàn thành và kết quả hiện tại là điều quan trọng",
          example: "I've booked the coach tickets."
        }
      ],
      notes: []
    },

    {
      id: "present-perfect-continuous",
      number: 4,
      title: "Present perfect continuous",
      status: "coming-soon",
      description: "",
      formula: null,
      formulaNote: null,
      forms: { columns: [], rows: [] },
      uses: [],
      notes: []
    },

    {
      id: "stative-verbs",
      number: 5,
      title: "Stative verbs",
      status: "coming-soon",
      description: "",
      formula: null,
      formulaNote: null,
      forms: { columns: [], rows: [] },
      uses: [],
      notes: []
    }
  ]
};

export default lessonData;
