import React, { useState, useEffect } from "react";
import { PDFDocument, StandardFonts } from "pdf-lib";
import "../index.css";
import logo from "../assets/aossie_logo.png";

const Output = () => {
  const [qaPairs, setQaPairs] = useState([]);
  const [questionType, setQuestionType] = useState(
    localStorage.getItem("selectedQuestionType")
  );

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  useEffect(() => {
    const qaPairsFromStorage =
      JSON.parse(localStorage.getItem("qaPairs")) || {};
    if (qaPairsFromStorage) {
      const combinedQaPairs = [];

      if (qaPairsFromStorage["output_boolq"]) {
        qaPairsFromStorage["output_boolq"]["Boolean_Questions"].forEach(
          (question, index) => {
            combinedQaPairs.push({
              question,
              question_type: "Boolean",
              context: qaPairsFromStorage["output_boolq"]["Text"],
            });
          }
        );
      }

      if (qaPairsFromStorage["output_mcq"]) {
        qaPairsFromStorage["output_mcq"]["questions"].forEach((qaPair) => {
          combinedQaPairs.push({
            question: qaPair.question_statement,
            question_type: "MCQ",
            options: qaPair.options,
            answer: qaPair.answer,
            context: qaPair.context,
          });
        });
      }

      if (qaPairsFromStorage["output_shortq"]) {
        qaPairsFromStorage["output_shortq"]["questions"].forEach((qaPair) => {
          combinedQaPairs.push({
            question: qaPair.Question,
            question_type: "Short",
            answer: qaPair.Answer,
            context: qaPair.context,
          });
        });
      }

      if (questionType === "get_mcq") {
        qaPairsFromStorage["output"].forEach((qaPair) => {
          const options = qaPair.answer
            .filter((ans) => !ans.correct)
            .map((ans) => ans.answer);
          const correctAnswer = qaPair.answer.find(
            (ans) => ans.correct
          )?.answer;

          combinedQaPairs.push({
            question: qaPair.question,
            question_type: "MCQ_Hard",
            options: options,
            answer: correctAnswer,
          });
        });
      }
      if (questionType === "get_matching" && qaPairsFromStorage["output"]) {
        const matchingQuestions = qaPairsFromStorage["output"].matching_questions;
        console.log(qaPairsFromStorage["output"]);
        if (matchingQuestions && Array.isArray(matchingQuestions)) {
          matchingQuestions.forEach((pair) => {
            combinedQaPairs.push({
              left_item: pair.term || pair.left,
              right_item: pair.definition || pair.right,
              question_type: "Matching",
              id: pair.id || Math.random().toString(36).substr(2, 9),
              isMatched: false
            });
          });
  
          const shuffledRightItems = shuffleArray([...combinedQaPairs.map(pair => ({
            item: pair.right_item,
            id: pair.id
          }))]);
          console.log("/", combinedQaPairs);
          setQaPairs([{
            question: "Match the following",
            originalPairs: combinedQaPairs,
            shuffledRightItems: shuffledRightItems,
            currentMatches: new Map(),
            question_type: "Matching"
          }]);
          console.log(qaPairs);
          return; // Add this to prevent further processing
        }
      }
      
      if (questionType == "get_boolq") {
        qaPairsFromStorage["output"].forEach((qaPair) => {
          combinedQaPairs.push({
            question: qaPair,
            question_type: "Boolean",
          });
        });
      } else if (qaPairsFromStorage["output"] && questionType !== "get_mcq") {
        qaPairsFromStorage["output"].forEach((qaPair) => {
          combinedQaPairs.push({
            question:
              qaPair.question || qaPair.question_statement || qaPair.Question,
            options: qaPair.options,
            answer: qaPair.answer || qaPair.Answer,
            context: qaPair.context,
            question_type: "Short",
          });
        });
      }

      setQaPairs(combinedQaPairs);
    }
  }, []);

  const generateGoogleForm = async () => {
    const response = await fetch(`${process.env.REACT_APP_BASE_URL}/generate_gform`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        qa_pairs: qaPairs,
        question_type: questionType,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const formUrl = result.form_link;
      window.open(formUrl, "_blank");
    } else {
      console.error("Failed to generate Google Form");
    }
  };

  const generatePDF = async () => {
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let page = pdfDoc.addPage();
    const d = new Date(Date.now());

    // Helper function for safe text drawing
    const drawSafeText = (text, x, y, options = {}) => {
        try {
            page.drawText(text, {
                font: helveticaFont,
                ...options,
                x,
                y,
            });
        } catch (error) {
            // Fallback for problematic characters
            const safeText = text.normalize('NFKD')
                                .replace(/[\u0300-\u036f]/g, '')
                                .replace(/[^\x00-\x7F]/g, '');
            page.drawText(safeText, {
                font: helveticaFont,
                ...options,
                x,
                y,
            });
        }
    };

    // Replace original drawText calls with drawSafeText
    drawSafeText("EduAid generated Quiz", 50, 800, { size: 20 });
    drawSafeText("Created On: " + d.toString(), 50, 770, { size: 10 });

    const form = pdfDoc.getForm();
    let y = 700;
    let questionIndex = 1;

    qaPairs.forEach((qaPair) => {
        if (y < 50) {
            page = pdfDoc.addPage();
            y = 700;
        }

        drawSafeText(`Q${questionIndex}) ${qaPair.question}`, 50, y, { size: 15 });
        y -= 30;

        if (qaPair.question_type === "Boolean") {
            const radioGroup = form.createRadioGroup(`question${questionIndex}_answer`);
            ["True", "False"].forEach((text) => {
                const options = { x: 70, y, width: 15, height: 15 };
                radioGroup.addOptionToPage(text, page, options);
                drawSafeText(text, 90, y + 2, { size: 12 });
                y -= 20;
            });
        } else if (qaPair.question_type === "MCQ" || qaPair.question_type === "MCQ_Hard") {
            const options = [...qaPair.options, qaPair.answer];
            options.sort(() => Math.random() - 0.5);

            const radioGroup = form.createRadioGroup(`question${questionIndex}_answer`);
            options.forEach((option) => {
                const radioOptions = { x: 70, y, width: 15, height: 15 };
                radioGroup.addOptionToPage(option, page, radioOptions);
                drawSafeText(option, 90, y + 2, { size: 12 });
                y -= 20;
            });
        } else if (qaPair.question_type === "Short") {
            const answerField = form.createTextField(`question${questionIndex}_answer`);
            answerField.setText("");
            answerField.addToPage(page, { x: 50, y: y - 20, width: 450, height: 20 });
            y -= 40;
        } else if (qaPair.question_type === "Matching") {
            const leftColumnX = 40;
            const rightColumnX = 150;
            const rowHeight = 90;
            const leftColumnWidth = 100;
            const rightColumnWidth = 400;
            const fontSize = 10;

            qaPair.leftItems = qaPair.originalPairs;
            qaPair.rightItems = qaPair.shuffledRightItems;

            if (!qaPair.leftItems || !qaPair.rightItems || qaPair.leftItems.length !== qaPair.rightItems.length) {
                console.error(`Invalid matching question data at index ${questionIndex}`);
                return;
            }

            // Changed to use drawSafeText for headers
            drawSafeText("Column A", leftColumnX, y, { size: fontSize });
            drawSafeText("Column B", rightColumnX, y, { size: fontSize });
            y -= 30;

            qaPair.leftItems.forEach((leftItem, index) => {
                if (y < 50) {
                    page = pdfDoc.addPage();
                    y = 700;
                }

                // Changed to use drawSafeText for left items
                drawSafeText(`${index + 1}. ${leftItem.left_item}`, leftColumnX, y, {
                    size: fontSize,
                    maxWidth: leftColumnWidth
                });

                // Changed to use drawSafeText for right items
                drawSafeText(`${index + 1}. ${qaPair.rightItems[index].item}`, rightColumnX, y, {
                    size: fontSize,
                    maxWidth: rightColumnWidth
                });

                y -= rowHeight;
            });

            y -= 40;
        }

        questionIndex += 1;
        y -= 20;
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "generated_questions.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

  return (
    <div className="popup w-full h-full bg-[#02000F] flex justify-center items-center">
      <div className="w-full h-full bg-cust bg-opacity-50 bg-custom-gradient">
        <div className="flex flex-col h-full">
          <a href="/">
            <div className="flex items-end gap-[2px]">
              <img src={logo} alt="logo" className="w-16 my-4 ml-4 block" />
              <div className="text-2xl mb-3 font-extrabold">
                <span className="bg-gradient-to-r from-[#FF005C] to-[#7600F2] text-transparent bg-clip-text">
                  Edu
                </span>
                <span className="bg-gradient-to-r from-[#7600F2] to-[#00CBE7] text-transparent bg-clip-text">
                  Aid
                </span>
              </div>
            </div>
          </a>
          <div className="font-bold text-xl text-white mt-3 mx-2">
            Generated Questions
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {qaPairs &&
              qaPairs.map((qaPair, index) => {
                const combinedOptions = qaPair.options
                  ? [...qaPair.options, qaPair.answer]
                  : [qaPair.answer];
                const shuffledOptions = shuffleArray(combinedOptions);
                return (
                  <div
                    key={index}
                    className="px-2 bg-[#d9d9d90d] border-black border my-1 mx-2 rounded-xl py-2"
                  >
                    <div className="text-[#E4E4E4] text-sm">
                      Question {index + 1}
                    </div>
                    <div className="text-[#FFF4F4] text-[1rem] my-1">
                      {qaPair.question}
                    </div>
                    {qaPair.question_type === "Matching" && qaPairs.map((qaPairSet, idx) => (
                      <div key={idx}>
                        <div className="text-[#E4E4E4] text-lg mb-4"></div>
                        <table className="table-auto w-full border-collapse border border-[#E4E4E4]">
                          <thead>
                            <tr>
                              <th className="border border-[#E4E4E4] p-2 text-left text-[#FFF4F4]">
                                Left Items
                              </th>
                              <th className="border border-[#E4E4E4] p-2 text-left text-[#FFF4F4]">
                                Shuffled Right Items
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {qaPairSet.originalPairs.map((pair, index) => (
                              <tr key={index}>
                                <td className="border border-[#E4E4E4] p-4 text-[#E4E4E4] text-sm">
                                  {pair.left_item}
                                </td>
                                <td className="border border-[#E4E4E4] p-4 text-[#FFF4F4] text-sm">
                                  {qaPairSet.shuffledRightItems[index]?.item || ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                    {qaPair.question_type !== "Boolean" && (
                      <>
                      {/* {console.log(":", qaPair)} */}
                        <div className="text-[#E4E4E4] text-sm">Answer</div>
                        <div className="text-[#FFF4F4] text-[1rem]">
                        {qaPair.originalPairs && qaPair.originalPairs.length > 0 && (
                          <div className="text-[#FFF4F4] text-[1rem] mt-2">
                            {qaPair.originalPairs.map((question, idx) => (
                              <div key={idx} className="mb-1">
                                <span className="text-[#E4E4E4] text-sm">
                                  {idx + 1}:
                                </span>{" "}
                                <span className="text-[#FFF4F4] text-[1rem]">
                                  {`${question.left_item} - ${question.right_item}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        </div>
                        {qaPair.options && qaPair.options.length > 0 && (
                          <div className="text-[#FFF4F4] text-[1rem]">
                            {shuffledOptions.map((option, idx) => (
                              <div key={idx}>
                                <span className="text-[#E4E4E4] text-sm">
                                  Option {idx + 1}:
                                </span>{" "}
                                <span className="text-[#FFF4F4] text-[1rem]">
                                  {option}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
          </div>
          <div className="items-center flex justify-center gap-6 mx-auto">
            <button
              className="bg-[#518E8E] items-center flex gap-1 my-2 font-semibold text-white px-2 py-2 rounded-xl"
              onClick={generateGoogleForm}
            >
              Generate Google form
            </button>
            <button
              className="bg-[#518E8E] items-center flex gap-1 my-2 font-semibold text-white px-2 py-2 rounded-xl"
              onClick={generatePDF}
            >
              Generate PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Output;
