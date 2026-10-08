import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { PendingPrompt, PromptDecision } from '../lib/frames'
import { Markdown } from '../lib/markdown'
import { theme } from '../lib/theme'

/**
 * The thing a session is blocked on.
 *
 * The terminal is showing the same question at the same time, so "answer in the
 * terminal" is a real answer rather than a cop-out — it hands the decision back
 * without leaving the session waiting.
 */
export function PromptCard({
  prompt,
  onDecide
}: {
  prompt: PendingPrompt
  onDecide: (decision: PromptDecision) => void
}): React.JSX.Element {
  const [feedback, setFeedback] = useState('')
  const [writing, setWriting] = useState(false)

  return (
    <View style={styles.card}>
      <Text style={styles.kind}>
        {prompt.kind === 'plan' ? 'PLAN' : prompt.kind === 'question' ? 'QUESTION' : 'PERMISSION'}
        <Text style={styles.tool}>  {prompt.toolName}</Text>
        {prompt.reasked ? <Text style={styles.tool}>  · asked again</Text> : null}
      </Text>

      {prompt.kind === 'plan' && prompt.plan ? (
        <View style={styles.plan}>
          <Markdown source={prompt.plan} />
        </View>
      ) : null}

      {prompt.kind === 'question' && prompt.questions ? (
        prompt.questions.map((question, qi) => (
          <View key={qi} style={styles.question}>
            <Text style={styles.questionText}>{question.question}</Text>
            {question.options.map((option) => (
              <Pressable
                key={option.label}
                style={styles.option}
                onPress={() => onDecide({ kind: 'respond', text: option.label })}
              >
                <Text style={styles.optionLabel}>{option.label}</Text>
                {option.description ? (
                  <Text style={styles.optionDesc}>{option.description}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ))
      ) : null}

      {prompt.kind === 'permission' ? <Text style={styles.summary}>{prompt.summary}</Text> : null}

      {writing ? (
        <View style={styles.feedbackBox}>
          <TextInput
            style={styles.input}
            value={feedback}
            onChangeText={setFeedback}
            placeholder={prompt.kind === 'plan' ? 'What should change?' : 'Why not?'}
            placeholderTextColor={theme.faint}
            multiline
            autoFocus
          />
          <Pressable
            style={[styles.button, styles.primary]}
            disabled={!feedback.trim()}
            onPress={() =>
              onDecide(
                prompt.kind === 'permission'
                  ? { kind: 'deny', reason: feedback.trim() }
                  : { kind: 'respond', text: feedback.trim() }
              )
            }
          >
            <Text style={styles.buttonText}>Send</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.row}>
        {prompt.kind !== 'question' ? (
          <Pressable
            style={[styles.button, styles.primary]}
            onPress={() => onDecide({ kind: 'allow' })}
          >
            <Text style={styles.buttonText}>
              {prompt.kind === 'plan' ? 'Approve' : 'Allow'}
            </Text>
          </Pressable>
        ) : null}

        {prompt.suggestedRule ? (
          <Pressable
            style={[styles.button, styles.secondary]}
            onPress={() => onDecide({ kind: 'allow', remember: true })}
          >
            <Text style={styles.buttonTextDim}>Always allow</Text>
          </Pressable>
        ) : null}

        <Pressable style={[styles.button, styles.secondary]} onPress={() => setWriting(!writing)}>
          <Text style={styles.buttonTextDim}>{prompt.kind === 'plan' ? 'Feedback' : 'Deny…'}</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.secondary]}
          onPress={() => onDecide({ kind: 'release' })}
        >
          <Text style={styles.buttonTextDim}>At the Mac</Text>
        </Pressable>
      </View>

      {prompt.suggestedRule ? (
        <Text style={styles.rule}>Always allow adds {prompt.suggestedRule}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.panelHi,
    borderColor: theme.warn,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 12
  },
  kind: { color: theme.warn, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  tool: { color: theme.faint, fontWeight: '400', letterSpacing: 0 },
  summary: { color: theme.text, fontFamily: theme.mono, fontSize: 13 },
  plan: { maxHeight: 320 },
  question: { gap: 8 },
  questionText: { color: theme.text, fontSize: 15, fontWeight: '600' },
  option: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10
  },
  optionLabel: { color: theme.text, fontSize: 14, fontWeight: '600' },
  optionDesc: { color: theme.dim, fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14 },
  primary: { backgroundColor: theme.accent },
  secondary: { backgroundColor: theme.panel, borderColor: theme.border, borderWidth: 1 },
  buttonText: { color: theme.bg, fontWeight: '700', fontSize: 13 },
  buttonTextDim: { color: theme.dim, fontWeight: '600', fontSize: 13 },
  feedbackBox: { gap: 8 },
  input: {
    color: theme.text,
    backgroundColor: theme.bg,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    minHeight: 64,
    fontSize: 14
  },
  rule: { color: theme.faint, fontSize: 11, fontFamily: theme.mono }
})
