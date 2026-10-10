package com.preppilot.nimcet2027

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(MobileFocusLockPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
