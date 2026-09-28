import Testing
import ManuOSCore

struct ChatTranscriptTests {
    @Test("Sending adds Manu's message and a reply")
    func send() {
        var chat = ChatTranscript()
        let intent = chat.send("  apunta llamar al taller ")
        #expect(intent == .captureIdea("llamar al taller"))
        #expect(chat.messages.map(\.author) == [.manu, .assistant])
        #expect(chat.messages[0].text == "apunta llamar al taller")
        #expect(chat.messages.map(\.id) == [0, 1])
    }

    @Test("Blank input is ignored")
    func blank() {
        var chat = ChatTranscript()
        #expect(chat.send("   ") == nil)
        #expect(chat.messages.isEmpty)
    }

    @Test("Crisis replies are flagged as safety critical")
    func crisisFlag() {
        var chat = ChatTranscript()
        chat.send("no quiero vivir")
        #expect(chat.messages.last?.isSafetyCritical == true)
        chat.send("qué tengo hoy")
        #expect(chat.messages.last?.isSafetyCritical == false)
    }

    @Test("Consecutive unknown inputs do not repeat the same reply")
    func noRepetition() {
        var chat = ChatTranscript()
        chat.send("hola")
        chat.send("hola otra vez")
        #expect(chat.messages[1].text != chat.messages[3].text)
    }
}
