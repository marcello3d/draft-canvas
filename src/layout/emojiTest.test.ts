import { customLinebreaker } from './customLinebreaker';
import type { AttributedString, Run } from '@react-pdf/textkit';

describe('Emoji handling in customLinebreaker', () => {
  it('should properly handle complex emoji string without repetition or incorrect breaks', () => {
    const testString = "😵‍💫👨‍👩‍👧‍👦👨🏾‍💻🧑‍🤝‍🧑👨‍❤️‍👨🏳️‍🌈👋🏽🤝🏻👨🏾‍💻🇺🇸🇯🇵🇬🇧1️⃣2️⃣3️⃣😀🎉🎊 🎈";
    
    const runs: Run[] = [{
      start: 0,
      end: testString.length,
      attributes: {
        fontSize: 60,
      },
    }];
    
    const attributedString: AttributedString = {
      string: testString,
      runs,
    };
    
    // Simulate a narrow container that will force wrapping
    const availableWidths = [400]; // Narrow width to force wrapping
    
    const linebreaker = customLinebreaker();
    const lines = linebreaker(attributedString, availableWidths);
    
    // Join all lines back together
    const reconstructed = lines.map(line => line.string).join('');
    
    // The reconstructed text should equal the original (minus any trailing spaces)
    expect(reconstructed).toBe(testString);
    
    // Check that we actually created multiple lines (wrapping occurred)
    expect(lines.length).toBeGreaterThan(1);
    
    // Check for no repetition - each line should be unique and in order
    let currentPos = 0;
    for (const line of lines) {
      const lineInOriginal = testString.indexOf(line.string, currentPos);
      expect(lineInOriginal).toBe(currentPos);
      currentPos += line.string.length;
    }
    
    // Log the lines for debugging
    console.log('Lines created:');
    lines.forEach((line, i) => {
      console.log(`  Line ${i}: "${line.string}"`);
    });
  });
  
  it('should not break flag emojis or ZWJ sequences', () => {
    // Test with specific problematic sequences
    const flagTest = "Before 🇺🇸🇯🇵🇬🇧 After";
    const zwjTest = "Family 👨‍👩‍👧‍👦 emoji";
    
    const testCases = [flagTest, zwjTest];
    
    for (const testString of testCases) {
      const runs: Run[] = [{
        start: 0,
        end: testString.length,
        attributes: {
          fontSize: 60,
        },
      }];
      
      const attributedString: AttributedString = {
        string: testString,
        runs,
      };
      
      // Use very narrow width to force potential breaking
      const availableWidths = [150];
      
      const linebreaker = customLinebreaker();
      const lines = linebreaker(attributedString, availableWidths);
      
      // Check that flags and ZWJ sequences are not split
      for (const line of lines) {
        // Flags should be complete (both regional indicators together)
        expect(line.string).not.toMatch(/🇺(?!🇸)/);
        expect(line.string).not.toMatch(/🇯(?!🇵)/);
        expect(line.string).not.toMatch(/🇬(?!🇧)/);
        
        // ZWJ sequences should not be broken (no line ending with ZWJ)
        expect(line.string).not.toMatch(/\u200D$/);
      }
    }
  });
});